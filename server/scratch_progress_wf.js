import { performAction } from "./services/workflowEngine.js";

async function main() {
  try {
    console.log("Progressing workflow instance...");
    const updated = await performAction(
      "41bc335e-b7a3-472d-b13d-4b220cf00a23",
      "783bc2d7-cad9-43b8-9c29-370958f74543", // acted by RO user
      ["2d120502-9daa-48b0-aee1-60fadffb68a3"], // RO role ID
      "SUBMIT",
      "RO submitting customer for review"
    );
    console.log("Success! Updated instance:", updated);
  } catch (err) {
    console.error("Failed to progress workflow:", err);
  }
}

main();
