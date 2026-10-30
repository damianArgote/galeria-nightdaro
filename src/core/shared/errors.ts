export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

/** A business rule rejected the input (e.g. a slug already in use). */
export class ConflictError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** The input broke a rule the user can fix (wrong file type, too large…). */
export class InvalidInputError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "InvalidInputError";
  }
}
