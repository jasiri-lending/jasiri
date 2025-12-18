import { runLoanInstallmentCron } from "./cron/loanInstallmentCron.js";

await runLoanInstallmentCron();
process.exit(0);
