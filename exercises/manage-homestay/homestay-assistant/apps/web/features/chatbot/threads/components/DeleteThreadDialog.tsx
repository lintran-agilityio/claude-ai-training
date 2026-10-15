"use client";

import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteThreadDialogProps = {
  open: boolean;
  threadLabel: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Soft-delete UX: archives the thread on Intelligence (recoverable via
 * includeArchived). Hard delete remains available for admin/erase flows.
 */
export const DeleteThreadDialog = ({
  open,
  threadLabel,
  isDeleting = false,
  onCancel,
  onConfirm,
}: DeleteThreadDialogProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isDeleting) {
          onCancel();
        }
      }}
    >
      <DialogContent
        showCloseButton={!isDeleting}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Archive className="size-5" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-medium text-foreground">
                Archive this thread?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This will archive{" "}
                <span className="font-medium text-foreground">{threadLabel}</span>{" "}
                and hide it from the sidebar. Messages stay stored and can be
                recovered later.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 text-white hover:bg-amber-500"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? "Archiving…" : "Archive thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
