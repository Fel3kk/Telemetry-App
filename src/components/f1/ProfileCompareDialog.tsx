import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProfileCompareRow = {
  label: string;
  leftValue: string | number;
  rightValue: string | number;
  winner?: "left" | "right" | null;
};

export function ProfileCompareDialog({
  open,
  onClose,
  profileType,
  context,
  leftName,
  rightName,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  profileType: string;
  context: string;
  leftName: string;
  rightName: string;
  rows: ProfileCompareRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-background [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.28)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb:hover]:bg-white/40">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">{profileType} comparison</DialogTitle>
          <DialogDescription>
            {context} · Better values are highlighted; ties stay neutral.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <span />
          <span className="truncate text-right font-bold">{leftName}</span>
          <span className="truncate text-right font-bold">{rightName}</span>
          {rows.map((row) => (
            <ComparisonRow key={row.label} row={row} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonRow({ row }: { row: ProfileCompareRow }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{row.label}</span>
      <ComparisonValue value={row.leftValue} isWinner={row.winner === "left"} />
      <ComparisonValue value={row.rightValue} isWinner={row.winner === "right"} />
    </>
  );
}

function ComparisonValue({ value, isWinner }: { value: string | number; isWinner: boolean }) {
  return (
    <span
      className={`rounded px-1 text-right font-semibold tabular-nums ${isWinner ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30" : ""}`}
    >
      {value}
      {isWinner && <span className="sr-only">, better result</span>}
    </span>
  );
}
