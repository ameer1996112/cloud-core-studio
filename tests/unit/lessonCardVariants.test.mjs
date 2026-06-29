import { strict as assert } from "node:assert";
import {
  formatDuration,
  formatSpots,
  formatTime,
  getLessonVisualMode,
  getLocalizedIntensity,
  getLocalizedLessonTitle,
  getLocalizedProgramName,
  getLocalizedTone,
  shouldUseImageCard,
} from "../../src/lib/lesson-card-variants.ts";

const aerial = {
  id: "aerial-1",
  title: "Cloud & Core Aerial Yoga",
  image_url: "https://assets.example.com/aerial.jpg",
  starts_at: "2026-07-01T07:30:00.000Z",
  duration_minutes: 55,
  program_type: {
    name: "Aerial Yoga",
    name_he: "יוגה אווירית",
    name_ar: "يوغا هوائية",
    level: "all_levels",
    energy: "calm",
  },
};

assert.equal(
  getLessonVisualMode({ index: 0, lesson: aerial, variant: "featured" }),
  "featured-image",
);
assert.equal(shouldUseImageCard({ index: 0, lesson: aerial, variant: "featured" }), true);

assert.equal(
  getLessonVisualMode({
    index: 1,
    lesson: { ...aerial, id: "aerial-2" },
    previousLesson: aerial,
    variant: "standard",
  }),
  "accent",
);

assert.equal(
  getLessonVisualMode({
    index: 4,
    lesson: { ...aerial, id: "mat-1", image_url: "https://assets.example.com/mat.jpg" },
    previousLesson: aerial,
    variant: "standard",
  }),
  "thumbnail",
);

assert.equal(getLessonVisualMode({ index: 0, lesson: aerial, variant: "compact" }), "accent");
assert.equal(shouldUseImageCard({ index: 1, lesson: aerial, previousLesson: aerial }), false);

assert.equal(getLocalizedProgramName(aerial.program_type, "he"), "יוגה אווירית");
assert.equal(getLocalizedProgramName(aerial.program_type, "ar"), "يوغا هوائية");
assert.equal(getLocalizedProgramName(aerial.program_type, "en"), "Aerial Yoga");
assert.equal(getLocalizedLessonTitle(aerial, "he"), "Cloud & Core — יוגה אווירית");
assert.equal(getLocalizedIntensity("all_levels", "he"), "לכל הרמות");
assert.equal(getLocalizedTone("calm", "en"), "Calm");

assert.equal(formatDuration(55, "he"), "55 דק׳");
assert.equal(formatDuration(55, "ar"), "55 دقيقة");
assert.equal(formatDuration(55, "en"), "55 min");
assert.equal(formatSpots(7, 10, "he"), "7 מקומות פנויים");
assert.equal(formatSpots(1, 10, "en"), "1 spot open");
assert.equal(formatSpots(0, 10, "ar"), "قائمة انتظار");
assert.equal(formatTime("2026-07-01T07:30:00.000Z", "en", "UTC"), "07:30");

console.log("lesson card variants OK");
