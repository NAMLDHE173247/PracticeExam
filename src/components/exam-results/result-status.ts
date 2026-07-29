import {
  CircleCheck,
  CircleAlert,
  CircleX,
  CircleHelp,
  Flag,
  Lightbulb,
  Trophy,
  Clock,
  type LucideIcon
} from "lucide-react";

export type ResultFilter =
  | "all"
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered"
  | "flagged";

export interface StatusMetadata {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const statusMap: Record<ResultFilter, StatusMetadata> = {
  all: {
    label: "Tất cả",
    icon: CircleHelp, // Not usually displayed as a badge, just for filter
    className: "status-all",
  },
  correct: {
    label: "Chính xác",
    icon: CircleCheck,
    className: "status-correct",
  },
  partial: {
    label: "Đúng một phần",
    icon: CircleAlert,
    className: "status-partial",
  },
  incorrect: {
    label: "Không chính xác",
    icon: CircleX,
    className: "status-incorrect",
  },
  unanswered: {
    label: "Chưa trả lời",
    icon: CircleHelp,
    className: "status-unanswered",
  },
  flagged: {
    label: "Đã đánh dấu",
    icon: Flag,
    className: "status-flagged",
  },
};

export const uiIcons = {
  explanation: Lightbulb,
  score: Trophy,
  time: Clock,
};
