import { test as setup } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";
import { signIn } from "./helpers";

setup("sign in once as admin", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: ADMIN_STATE });
});
