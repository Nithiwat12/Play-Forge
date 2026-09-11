import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

interface VoteRequestModalProps {
  callerNames: string[];
  callerCount: number;
  requiredCount: number;
  isSpy: boolean;
  isSubmitting: boolean;
  onAgree: () => void;
  onDismiss: () => void;
}

// Pops up for anyone who hasn't called for a vote yet, whenever someone
// else does - a hard-to-miss prompt instead of the easy-to-overlook
// "X / Y คนขอโหวตแล้ว" counter alone. Dismissing it doesn't call a vote;
// it just goes away until the count moves again.
export function VoteRequestModal({
  callerNames,
  callerCount,
  requiredCount,
  isSpy,
  isSubmitting,
  onAgree,
  onDismiss,
}: VoteRequestModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <Card className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
          มีคนขอเปิดโหวต
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {callerNames.join(", ")} ขอเปิดโหวตหาสปาย
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          ตอนนี้มี {callerCount} / {requiredCount} คนที่ต้องการเปิดโหวตแล้ว
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onDismiss} disabled={isSubmitting}>
            ยังไม่ตอนนี้
          </Button>
          <Button
            variant={isSpy ? "danger" : "primary"}
            onClick={onAgree}
            isLoading={isSubmitting}
          >
            {isSpy ? "หยุดเกม (ขอตอบ)" : "เห็นด้วย - ขอเปิดโหวตด้วย"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
