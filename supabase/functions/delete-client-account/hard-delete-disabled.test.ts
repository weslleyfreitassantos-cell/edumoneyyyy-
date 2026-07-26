const source = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test("delete-client-account returns hard delete disabled response", () => {
  if (!source.includes("HARD_DELETE_DISABLED")) {
    throw new Error("Missing HARD_DELETE_DISABLED response code.");
  }

  if (!source.includes("410")) {
    throw new Error("Missing HTTP 410 response.");
  }
});

Deno.test("delete-client-account does not perform destructive deletion", () => {
  if (source.includes(".delete(")) {
    throw new Error("Unexpected table delete operation found.");
  }

  if (source.includes("deleteUser(")) {
    throw new Error("Unexpected auth user deletion found.");
  }
});
