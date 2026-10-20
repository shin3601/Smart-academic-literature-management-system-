
import { supabase } from "./supabase.js";
import { getCurrentProfile } from "./roles.js";

// ========================================
// SMART ACADEMIC LECTURE MANAGEMENT SYSTEM
// ADMIN - ACTIVITIES AND GRADES
// ========================================

const $ = (id) => document.getElementById(id);

const form = $("activityForm");
const titleInput = $("activityTitle");
const descriptionInput = $("activityDescription");
const instructionsInput = $("activityInstructions");
const dueDateInput = $("activityDueDate");
const maxScoreInput = $("activityMaxScore");

const formTitle = $("activityFormTitle");
const saveButton = $("saveActivityBtn");
const cancelButton = $("cancelActivityBtn");
const messageBox = $("activityMessage");

const activityCount = $("activityCount");
const activitiesList = $("activitiesList");

const submissionsTitle = $("submissionsTitle");
const submissionsHint = $("submissionsHint");
const submissionsList = $("submissionsList");

const logoutButton = $("logoutBtn");

let currentAdmin = null;
let editingId = null;
let activities = [];
let selectedActivityId = null;

// ========================================
// HELPER FUNCTIONS
// ========================================

function showMessage(message, type = "error") {
  messageBox.textContent = message;
  messageBox.className = "message " + type;
}

function formatDate(value) {
  if (!value) return "No deadline";

  return new Date(value).toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function localDateValue(value) {
  if (!value) return "";

  const date = new Date(value);

  const adjusted = new Date(
    date.getTime() -
    date.getTimezoneOffset() * 60000
  );

  return adjusted.toISOString().slice(0, 16);
}

function createText(tag, text, className = "") {
  const item = document.createElement(tag);

  item.textContent = text;

  if (className) {
    item.className = className;
  }

  return item;
}

function createButton(text, className, action) {
  const item = document.createElement("button");

  item.type = "button";
  item.textContent = text;
  item.className = className;

  item.addEventListener("click", action);

  return item;
}

// ========================================
// ADMIN AUTHENTICATION
// ========================================

async function initialize() {
  form.hidden = true;

  try {
    const profile = await getCurrentProfile();

    if (!profile || profile.role !== "admin") {
      window.location.replace("index.html");
      return;
    }

    currentAdmin = profile;
    form.hidden = false;

    await loadActivities();

  } catch (error) {
    showMessage(
      error.message || "Unable to load page."
    );
  }
}

// ========================================
// LOAD ACTIVITIES FROM SUPABASE
// ========================================

async function loadActivities() {
  activityCount.textContent = "Loading activities...";

  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, title, description, instructions, due_date, max_score, created_at"
    )
    .order("created_at", {
      ascending: false
    });

  if (error) {
    showMessage(error.message);

    activityCount.textContent =
      "Unable to load activities.";

    return;
  }

  activities = data || [];

  activityCount.textContent =
    activities.length + " activity(s)";

  displayActivities();
}

// ========================================
// DISPLAY ACTIVITIES
// ========================================

function displayActivities() {
  activitiesList.replaceChildren();

  if (activities.length === 0) {
    activitiesList.appendChild(
      createText(
        "p",
        "No activities yet. Create your first activity!",
        "muted"
      )
    );

    return;
  }

  activities.forEach((activity) => {
    const card = document.createElement("div");
    card.className = "activity-card";

    card.appendChild(
      createText("h3", activity.title)
    );

    card.appendChild(
      createText(
        "p",
        activity.description || "No description."
      )
    );

    card.appendChild(
      createText(
        "p",
        "Instructions: " +
        (activity.instructions || "None")
      )
    );

    card.appendChild(
      createText(
        "p",
        "Deadline: " + formatDate(activity.due_date),
        "muted"
      )
    );

    card.appendChild(
      createText(
        "p",
        "Maximum Score: " + activity.max_score,
        "muted"
      )
    );

    const actions = document.createElement("div");
    actions.className = "activity-actions";

    actions.appendChild(
      createButton(
        "View Submissions",
        "primary-action",
        () => loadSubmissions(activity)
      )
    );

    actions.appendChild(
      createButton(
        "Edit",
        "secondary-action",
        () => editActivity(activity)
      )
    );

    actions.appendChild(
      createButton(
        "Delete",
        "danger-action",
        () => deleteActivity(activity)
      )
    );

    card.appendChild(actions);

    activitiesList.appendChild(card);
  });
}

// ========================================
// CREATE OR UPDATE ACTIVITY
// ========================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentAdmin) {
    showMessage("Admin access required.");
    return;
  }

  const title = titleInput.value.trim();

  const description =
    descriptionInput.value.trim();

  const instructions =
    instructionsInput.value.trim();

  const maxScore = Number(maxScoreInput.value);

  if (!title) {
    showMessage("Please enter an activity title.");
    return;
  }

  if (
    !Number.isSafeInteger(maxScore) ||
    maxScore < 1
  ) {
    showMessage(
      "Maximum score must be a positive whole number."
    );

    return;
  }

  let dueDate = null;

  if (dueDateInput.value) {
    const date = new Date(dueDateInput.value);

    if (Number.isNaN(date.getTime())) {
      showMessage("Invalid deadline.");
      return;
    }

    dueDate = date.toISOString();
  }

  const payload = {
    title: title,
    description: description,
    instructions: instructions,
    due_date: dueDate,
    max_score: maxScore
  };

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  showMessage("");

  try {
    let result;

    if (editingId) {
      result = await supabase
        .from("activities")
        .update(payload)
        .eq("id", editingId)
        .select("id")
        .single();

    } else {
      result = await supabase
        .from("activities")
        .insert({
          ...payload,
          created_by: currentAdmin.id
        })
        .select("id")
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    resetForm();

    await loadActivities();

    showMessage(
      "Activity saved successfully!",
      "success"
    );

  } catch (error) {
    showMessage(
      error.message || "Unable to save activity."
    );

  } finally {
    saveButton.disabled = false;

    saveButton.textContent = editingId
      ? "Update Activity"
      : "Save Activity";
  }
});

// ========================================
// EDIT ACTIVITY
// ========================================

function editActivity(activity) {
  editingId = activity.id;

  titleInput.value = activity.title;

  descriptionInput.value =
    activity.description || "";

  instructionsInput.value =
    activity.instructions || "";

  dueDateInput.value =
    localDateValue(activity.due_date);

  maxScoreInput.value = activity.max_score;

  formTitle.textContent = "Edit Activity";

  saveButton.textContent = "Update Activity";

  cancelButton.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ========================================
// RESET FORM
// ========================================

function resetForm() {
  editingId = null;

  form.reset();

  maxScoreInput.value = 100;

  formTitle.textContent =
    "Create New Activity";

  saveButton.textContent =
    "Save Activity";

  cancelButton.hidden = true;
}

cancelButton.addEventListener(
  "click",
  resetForm
);

// ========================================
// DELETE ACTIVITY
// ========================================

async function deleteActivity(activity) {
  const confirmed = confirm(
    'Delete "' + activity.title +
    '" and all its student submissions and grades?'
  );

  if (!confirmed) return;

  const { data, error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activity.id)
    .select("id");

  if (error) {
    showMessage(error.message);
    return;
  }

  if (!data || data.length === 0) {
    showMessage(
      "Activity could not be deleted."
    );
    return;
  }

  if (editingId === activity.id) {
    resetForm();
  }

  if (selectedActivityId === activity.id) {
    selectedActivityId = null;

    submissionsTitle.textContent =
      "Student Submissions";

    submissionsHint.textContent =
      "Select View Submissions on an activity.";

    submissionsList.replaceChildren();
  }

  await loadActivities();

  showMessage(
    "Activity deleted successfully!",
    "success"
  );
}

// ========================================
// LOAD STUDENT SUBMISSIONS
// ========================================

async function loadSubmissions(activity) {
  selectedActivityId = activity.id;

  submissionsTitle.textContent =
    "Submissions: " + activity.title;

  submissionsHint.textContent =
    "Loading submissions...";

  submissionsList.replaceChildren();

  try {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select(
        "id, student_id, answer, submitted_at, score, feedback, graded_at"
      )
      .eq("activity_id", activity.id)
      .order("submitted_at", {
        ascending: false
      });

    if (error) throw error;

    if (selectedActivityId !== activity.id) {
      return;
    }

    const submissions = data || [];

    if (submissions.length === 0) {
      submissionsHint.textContent =
        "No student submissions yet.";

      return;
    }

    const studentIds = [
      ...new Set(
        submissions.map(
          submission => submission.student_id
        )
      )
    ];

    const {
      data: profiles,
      error: profileError
    } = await supabase
      .from("profiles")
      .select("id, full_name, student_id")
      .in("id", studentIds);

    if (profileError) {
      console.warn(profileError.message);
    }

    if (selectedActivityId !== activity.id) {
      return;
    }

    const profileMap = new Map(
      (profiles || []).map(profile => [
        profile.id,
        profile
      ])
    );

    submissionsHint.textContent =
      submissions.length + " submission(s)";

    submissions.forEach((submission) => {
      const student = profileMap.get(
        submission.student_id
      );

      displaySubmission(
        submission,
        student,
        activity
      );
    });

  } catch (error) {
    if (selectedActivityId === activity.id) {
      submissionsHint.textContent =
        "Unable to load submissions.";

      showMessage(
        error.message ||
        "Unable to load submissions."
      );
    }
  }
}

// ========================================
// DISPLAY SUBMISSION AND GRADING FORM
// ========================================

function displaySubmission(
  submission,
  student,
  activity
) {
  const card = document.createElement("div");
  card.className = "submission-card";

  card.appendChild(
    createText(
      "h3",
      student?.full_name || "Student"
    )
  );

  card.appendChild(
    createText(
      "p",
      "Student ID: " +
      (student?.student_id || "Unavailable"),
      "muted"
    )
  );

  card.appendChild(
    createText(
      "p",
      "Submitted: " +
      formatDate(submission.submitted_at),
      "muted"
    )
  );

  card.appendChild(
    createText(
      "p",
      "Answer:\n" + submission.answer
    )
  );

  const grade = submission.score === null
    ? "Not graded"
    : submission.score + " / " + activity.max_score;

  card.appendChild(
    createText("p", "Grade: " + grade)
  );

  const gradeForm = document.createElement("form");
  gradeForm.className = "grade-form";

  const scoreLabel = createText(
    "label",
    "Score (0 to " + activity.max_score + ")"
  );

  const scoreInput = document.createElement("input");

  scoreInput.type = "number";
  scoreInput.min = "0";
  scoreInput.max = String(activity.max_score);
  scoreInput.step = "1";
  scoreInput.required = true;

  if (submission.score !== null) {
    scoreInput.value = submission.score;
  }

  const feedbackLabel = createText(
    "label",
    "Feedback (Optional)"
  );

  const feedbackInput =
    document.createElement("textarea");

  feedbackInput.value =
    submission.feedback || "";

  feedbackInput.placeholder =
    "Write feedback for the student";

  const gradeButton =
    document.createElement("button");

  gradeButton.type = "submit";
  gradeButton.className = "primary-action";
  gradeButton.textContent = "Save Grade";

  gradeForm.append(
    scoreLabel,
    scoreInput,
    feedbackLabel,
    feedbackInput,
    gradeButton
  );

  // SAVE GRADE TO SUPABASE

  gradeForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const score = Number(scoreInput.value);

      if (
        !Number.isSafeInteger(score) ||
        score < 0 ||
        score > activity.max_score
      ) {
        showMessage(
          "Score must be a whole number from 0 to " +
          activity.max_score + "."
        );

        return;
      }

      gradeButton.disabled = true;
      gradeButton.textContent = "Saving...";

      try {
        const { data, error } = await supabase
          .from("activity_submissions")
          .update({
            score: score,
            feedback: feedbackInput.value.trim(),
            graded_at: new Date().toISOString()
          })
          .eq("id", submission.id)
          .select("id")
          .single();

        if (error) throw error;

        showMessage(
          "Grade saved successfully!",
          "success"
        );

        if (
          data &&
          selectedActivityId === activity.id
        ) {
          await loadSubmissions(activity);
        }

      } catch (error) {
        showMessage(
          error.message ||
          "Unable to save grade."
        );

      } finally {
        gradeButton.disabled = false;
        gradeButton.textContent = "Save Grade";
      }
    }
  );

  card.appendChild(gradeForm);

  submissionsList.appendChild(card);
}

// ========================================
// LOGOUT BUTTON
// ========================================

logoutButton.addEventListener(
  "click",
  async () => {
    logoutButton.disabled = true;

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      logoutButton.disabled = false;
      return;
    }

    window.location.replace("index.html");
  }
);

// ========================================
// INITIALIZE PAGE
// ========================================

initialize();
    
