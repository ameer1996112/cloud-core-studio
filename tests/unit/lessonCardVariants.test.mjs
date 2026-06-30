import { strict as assert } from "node:assert";
import {
  formatDuration,
  formatSpots,
  formatTime,
  getArtTileVariant,
  getLessonAvailabilityMeter,
  getLessonVisualMode,
  getLocalizedIntensity,
  getLocalizedLessonTitle,
  getLocalizedProgramName,
  getLocalizedTone,
  shouldShowLessonThumbnail,
  shouldUseImageCard,
} from "../../src/lib/lesson-card-variants.ts";
import { localizedClassMetadataChips } from "../../src/lib/localized-content.ts";

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

const mat = {
  id: "mat-1",
  title: "Core Precision — Pilates Mat",
  starts_at: "2026-07-01T09:00:00.000Z",
  duration_minutes: 45,
  energy: "flow",
  program_type: {
    name: "Mat Pilates",
    level: "all-levels",
  },
};

assert.equal(
  getLessonVisualMode({ index: 0, lesson: aerial, variant: "featured", context: "memberHome" }),
  "image",
);
assert.equal(
  shouldUseImageCard({ index: 0, lesson: aerial, variant: "featured", context: "memberHome" }),
  true,
);

assert.equal(
  getLessonVisualMode({
    index: 1,
    lesson: { ...aerial, id: "aerial-2" },
    previousLesson: aerial,
    variant: "featured",
    context: "memberSchedule",
  }),
  "image",
);

assert.equal(
  getLessonVisualMode({
    index: 1,
    lesson: { ...aerial, id: "aerial-2" },
    previousLesson: aerial,
    variant: "standard",
    context: "memberSchedule",
  }),
  "image",
);

assert.equal(
  shouldShowLessonThumbnail({
    index: 1,
    lesson: { ...aerial, id: "aerial-2" },
    previousLesson: aerial,
    context: "memberSchedule",
  }),
  true,
);

assert.equal(
  shouldShowLessonThumbnail({
    index: 2,
    lesson: { ...aerial, id: "mat-2", image_url: "https://assets.example.com/mat.jpg" },
    previousLesson: aerial,
    context: "memberSchedule",
  }),
  true,
);

assert.equal(
  shouldShowLessonThumbnail({
    index: 3,
    lesson: { ...aerial, id: "mat-3", image_url: "https://assets.example.com/mat.jpg" },
    previousLesson: aerial,
    context: "memberSchedule",
  }),
  true,
);

assert.equal(
  getLessonVisualMode({
    index: 4,
    lesson: { ...aerial, id: "mat-1", image_url: "https://assets.example.com/mat.jpg" },
    previousLesson: aerial,
    variant: "standard",
    context: "memberHome",
  }),
  "image",
);

assert.equal(
  getLessonVisualMode({ index: 0, lesson: aerial, variant: "compact", context: "memberSchedule" }),
  "minimal",
);
assert.equal(
  shouldShowLessonThumbnail({
    index: 0,
    lesson: mat,
    variant: "standard",
    context: "memberSchedule",
  }),
  true,
);
assert.equal(
  shouldShowLessonThumbnail({
    index: 0,
    lesson: mat,
    variant: "compact",
    context: "memberSchedule",
  }),
  false,
);
assert.equal(
  shouldUseImageCard({
    index: 1,
    lesson: aerial,
    previousLesson: aerial,
    variant: "featured",
    context: "memberHome",
  }),
  true,
);

assert.equal(getLocalizedProgramName(aerial.program_type, "he"), "יוגה אווירית");
assert.equal(getLocalizedProgramName(aerial.program_type, "ar"), "يوغا هوائية");
assert.equal(getLocalizedProgramName(aerial.program_type, "en"), "Aerial Yoga");
assert.equal(getLocalizedProgramName({ name: "Pilates Mat" }, "en"), "Mat Pilates");
assert.equal(getLocalizedProgramName({ name: "Mat Pilates" }, "he"), "פילאטיס מזרן");
assert.equal(getLocalizedLessonTitle(aerial, "he"), "Cloud & Core — יוגה אווירית");
assert.equal(getLocalizedIntensity("all_levels", "he"), "לכל הרמות");
assert.equal(getLocalizedIntensity("all-levels", "he"), "לכל הרמות");
assert.equal(getLocalizedIntensity("beginner-to-intermediate", "ar"), "مبتدئات–متوسط");
assert.equal(getLocalizedTone("calm", "en"), "Calm");
assert.deepEqual(localizedClassMetadataChips(mat, "he"), [
  "פילאטיס מזרן",
  "לכל הרמות",
  "חיזוק ודיוק",
]);
assert.notEqual(getArtTileVariant(aerial, 0), getArtTileVariant(aerial, 1));
assert.equal(getArtTileVariant({ ...aerial, id: "aerial-1" }, 0), getArtTileVariant(aerial, 0));

assert.equal(formatDuration(55, "he"), "55 דק׳");
assert.equal(formatDuration(55, "ar"), "55 دقيقة");
assert.equal(formatDuration(55, "en"), "55 min");
assert.equal(formatSpots(7, 10, "he"), "7 מקומות פנויים");
assert.equal(formatSpots(1, 10, "en"), "1 spot open");
assert.equal(formatSpots(0, 10, "ar"), "قائمة انتظار");
assert.equal(formatTime("2026-07-01T07:30:00.000Z", "en", "UTC"), "07:30");

assert.deepEqual(pickMeter(getLessonAvailabilityMeter({ capacity: 10, bookedCount: 3, lang: "he" })), {
  shouldRender: true,
  spotsLeft: 7,
  capacity: 10,
  bookedCount: 3,
  bookedRatio: 0.3,
  fillPercent: 30,
  isLow: false,
  label: "7 מקומות פנויים",
  assistiveLabel: "7 מקומות פנויים מתוך 10",
});

assert.deepEqual(pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 6, lang: "he" })), {
  shouldRender: true,
  spotsLeft: 2,
  capacity: 8,
  bookedCount: 6,
  bookedRatio: 0.75,
  fillPercent: 75,
  isLow: true,
  label: "נותרו 2 מקומות בלבד",
  assistiveLabel: "נותרו 2 מקומות בלבד מתוך 8",
});

assert.deepEqual(pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 7, lang: "en" })), {
  shouldRender: true,
  spotsLeft: 1,
  capacity: 8,
  bookedCount: 7,
  bookedRatio: 0.875,
  fillPercent: 88,
  isLow: true,
  label: "Only 1 spot left",
  assistiveLabel: "Only 1 spot left out of 8",
});

assert.deepEqual(pickMeter(getLessonAvailabilityMeter({ capacity: 8, bookedCount: 8, lang: "ar" })), {
  shouldRender: true,
  spotsLeft: 0,
  capacity: 8,
  bookedCount: 8,
  bookedRatio: 1,
  fillPercent: 100,
  isLow: true,
  label: "قائمة الانتظار مفتوحة",
  assistiveLabel: "قائمة الانتظار مفتوحة",
});

assert.equal(
  getLessonAvailabilityMeter({ capacity: 0, bookedCount: 0, lang: "he" }).shouldRender,
  false,
);

function pickMeter(model) {
  return {
    shouldRender: model.shouldRender,
    spotsLeft: model.spotsLeft,
    capacity: model.capacity,
    bookedCount: model.bookedCount,
    bookedRatio: model.bookedRatio,
    fillPercent: model.fillPercent,
    isLow: model.isLow,
    label: model.label,
    assistiveLabel: model.assistiveLabel,
  };
}

console.log("lesson card variants OK");
