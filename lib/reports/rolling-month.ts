export type DateRange = {
  from: Date;
  to: Date;
};

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function endOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999
  );
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function addMonthsClamped(value: Date, months: number) {
  const targetMonthIndex = value.getMonth() + months;
  const targetYear =
    value.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth =
    ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    value.getDate(),
    getDaysInMonth(targetYear, normalizedMonth)
  );

  return new Date(
    targetYear,
    normalizedMonth,
    targetDay,
    value.getHours(),
    value.getMinutes(),
    value.getSeconds(),
    value.getMilliseconds()
  );
}

export function getRollingMonthRange(anchor = new Date()): DateRange {
  return {
    from: startOfDay(addMonthsClamped(anchor, -1)),
    to: endOfDay(anchor),
  };
}

export function getPreviousRollingMonthRange(anchor = new Date()): DateRange {
  return {
    from: startOfDay(addMonthsClamped(anchor, -2)),
    to: endOfDay(addMonthsClamped(anchor, -1)),
  };
}

export function getRollingQuarterRange(anchor = new Date()): DateRange {
  return {
    from: startOfDay(addMonthsClamped(anchor, -3)),
    to: endOfDay(anchor),
  };
}

export function getPreviousRollingQuarterRange(anchor = new Date()): DateRange {
  return {
    from: startOfDay(addMonthsClamped(anchor, -6)),
    to: endOfDay(addMonthsClamped(anchor, -3)),
  };
}
