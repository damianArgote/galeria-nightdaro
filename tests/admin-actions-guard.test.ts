import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Middleware only redirects pages; a Server Action can be invoked by POSTing to any route.
 * requireAdmin() is the real guard, so every admin Server Action must start with it.
 */
const ADMIN_DIR = "src/app/admin";
const ALLOWED_WITHOUT_GUARD = new Set(["src/app/admin/actions.ts#logout"]);

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return serverActionFiles(path);
    const isSource = /\.tsx?$/.test(entry.name);
    return isSource && /^["']use server["']/.test(readFileSync(path, "utf8").trimStart())
      ? [path]
      : [];
  });
}

/** True when the action has no input, or hands its first parameter to runAction(schema, input). */
function validatesInput(action: ts.FunctionDeclaration, source: ts.SourceFile): boolean {
  const input = action.parameters[0];
  if (!input) return true;
  const name = input.name.getText(source);
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "runAction" &&
      node.arguments[1]?.getText(source) === name
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  if (action.body) visit(action.body);
  return found;
}

function exportedActions(file: string, text = readFileSync(file, "utf8")) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const actions: { name: string; guarded: boolean; validated: boolean }[] = [];
  for (const statement of source.statements) {
    const exported = ts
      .getModifiers(statement as ts.HasModifiers)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (!ts.isFunctionDeclaration(statement) || !statement.name) {
      // Anything else exported from a "use server" file could bypass the check.
      actions.push({
        name: statement.getText(source).slice(0, 40),
        guarded: false,
        validated: false,
      });
      continue;
    }
    const first = statement.body?.statements[0];
    const guarded =
      !!first &&
      ts.isExpressionStatement(first) &&
      ts.isAwaitExpression(first.expression) &&
      ts.isCallExpression(first.expression.expression) &&
      first.expression.expression.expression.getText(source) === "requireAdmin";
    actions.push({
      name: statement.name.text,
      guarded,
      validated: validatesInput(statement, source),
    });
  }
  return actions;
}

const ADMIN_API_DIR = "src/app/api/admin";

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

/** Every export of an admin route must be `adminRoute(...)`. */
function unguardedRouteExports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
  const problems: string[] = [];
  for (const statement of source.statements) {
    const exported = ts
      .getModifiers(statement as ts.HasModifiers)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (!ts.isVariableStatement(statement)) {
      problems.push(`${file}#${statement.getText(source).slice(0, 40)}`);
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      const guarded =
        !!init && ts.isCallExpression(init) && init.expression.getText(source) === "adminRoute";
      if (!guarded) problems.push(`${file}#${declaration.name.getText(source)}`);
    }
  }
  return problems;
}

describe("admin route handlers", () => {
  const files = routeFiles(ADMIN_API_DIR);

  it("finds the admin routes", () => {
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it("are all wrapped in adminRoute()", () => {
    expect(files.flatMap(unguardedRouteExports)).toEqual([]);
  });
});

describe("admin Server Actions", () => {
  const files = serverActionFiles(ADMIN_DIR);

  it("finds the admin action files", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it("all start with `await requireAdmin()`", () => {
    const unguarded = files.flatMap((file) =>
      exportedActions(file)
        .filter((a) => !a.guarded && !ALLOWED_WITHOUT_GUARD.has(`${file}#${a.name}`))
        .map((a) => `${file}#${a.name}`),
    );
    expect(unguarded).toEqual([]);
  });

  it("validate their input with Zod through runAction(schema, input)", () => {
    const unvalidated = files.flatMap((file) =>
      exportedActions(file)
        .filter((a) => !a.validated)
        .map((a) => `${file}#${a.name}`),
    );
    expect(unvalidated).toEqual([]);
  });

  it("the validation check catches an action that skips runAction", () => {
    const [skipped, validated, noInput] = exportedActions(
      "fixture.ts",
      `"use server";
      export async function skips(input: unknown) {
        await requireAdmin();
        return container.deleteArtwork.execute(input as never);
      }
      export async function validates(input: unknown) {
        await requireAdmin();
        return runAction(schema, input, (data) => container.deleteArtwork.execute(data));
      }
      export async function noInput() {
        await requireAdmin();
      }`,
    );
    expect(skipped).toMatchObject({ name: "skips", validated: false });
    expect(validated).toMatchObject({ name: "validates", validated: true });
    expect(noInput).toMatchObject({ name: "noInput", validated: true });
  });
});
