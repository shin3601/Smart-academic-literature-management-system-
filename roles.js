
import { supabase } from "./supabase.js";

export async function getCurrentProfile() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, student_id, role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile error:", error.message);
    return null;
  }

  return profile;
}

export async function redirectByRole() {
  const profile = await getCurrentProfile();

  if (!profile) {
    window.location.replace("index.html");
    return;
  }

  if (profile.role === "admin") {
    window.location.replace("admin.html");
  } else if (profile.role === "student") {
    window.location.replace("student.html");
  } else {
    window.location.replace("index.html");
  }
}
