import {
  TASK_SUBJECTS,
  getTasksForDate,
} from "./task-store.js";

const MAX_RANGE_DAYS = 370;

export function summarizeTasksForDate(store, date) {
  assertValidDate(date);
  return summarizeTaskList(getTasksForDate(store, date));
}

export function summarizeTasksForRange(store, startDate, endDate) {
  assertValidDate(startDate);
  assertValidDate(endDate);
  if (startDate > endDate) throw new Error("集計期間が正しくありません");

  const tasks = [];
  let current = startDate;
  let dayCount = 0;
  while (current <= endDate) {
    tasks.push(...getTasksForDate(store, current));
    dayCount += 1;
    if (dayCount > MAX_RANGE_DAYS) throw new Error("集計期間が長すぎます");
    current = shiftDate(current, 1);
  }
  return summarizeTaskList(tasks);
}

export function getWeekRange(date) {
  assertValidDate(date);
  const parsed = parseDate(date);
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7;
  const startDate = formatDate(addUtcDays(parsed, -daysSinceMonday));
  return {
    startDate,
    endDate: shiftDate(startDate, 6),
  };
}

export function summarizeTaskList(tasks) {
  const subjects = new Map(TASK_SUBJECTS.map((subject) => [subject, {
    subject,
    plannedMinutes: 0,
    completedMinutes: 0,
    taskCount: 0,
    completedTaskCount: 0,
  }]));

  let plannedMinutes = 0;
  let completedMinutes = 0;
  let completedTasks = 0;

  for (const task of tasks) {
    const minutes = Math.max(0, Number(task.plannedMinutes) || 0);
    plannedMinutes += minutes;
    if (task.completed) {
      completedMinutes += minutes;
      completedTasks += 1;
    }

    const summary = subjects.get(task.subject) || subjects.get("その他");
    summary.plannedMinutes += minutes;
    summary.taskCount += 1;
    if (task.completed) {
      summary.completedMinutes += minutes;
      summary.completedTaskCount += 1;
    }
  }

  const subjectBreakdown = [...subjects.values()]
    .filter((subject) => subject.plannedMinutes > 0)
    .map((subject) => ({
      ...subject,
      remainingMinutes: subject.plannedMinutes - subject.completedMinutes,
      completionRate: calculateRate(subject.completedMinutes, subject.plannedMinutes),
    }));

  return {
    taskCount: tasks.length,
    completedTasks,
    remainingTasks: tasks.length - completedTasks,
    plannedMinutes,
    completedMinutes,
    remainingMinutes: plannedMinutes - completedMinutes,
    completionRate: calculateRate(completedMinutes, plannedMinutes),
    subjectBreakdown,
  };
}

function calculateRate(completed, planned) {
  if (planned <= 0) return 0;
  return Math.round((completed / planned) * 100);
}

function shiftDate(date, amount) {
  return formatDate(addUtcDays(parseDate(date), amount));
}

function parseDate(date) {
  return new Date(`${date}T00:00:00Z`);
}

function addUtcDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日付が正しくありません");
  const parsed = parseDate(date);
  if (Number.isNaN(parsed.getTime()) || formatDate(parsed) !== date) throw new Error("日付が正しくありません");
}
