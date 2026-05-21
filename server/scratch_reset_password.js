import { supabaseAdmin } from "./supabaseClient.js";

async function main() {
  try {
    const userId = "2b291660-36c0-4eb7-8456-9d2e0c7816ba";
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: "Admin123!" }
    );
    if (error) throw error;
    console.log("Success! Password updated to 'Admin123!' for malobarich5@gmail.com");
  } catch (err) {
    console.error("Failed to update password:", err);
  }
}

main();
