"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RenameThreadDialogProps = {
  open: boolean;
  initialName: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export const RenameThreadDialog = ({
  open,
  initialName,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: RenameThreadDialogProps) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [initialName, open]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onConfirm(trimmedName);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <DialogContent
        showCloseButton={!isSubmitting}
        className="sm:max-w-md"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                <Pencil className="size-5" />
              </div>
              <div className="space-y-1.5">
                <DialogTitle className="text-lg font-medium text-foreground">
                  Rename thread
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Enter a new name for this conversation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-2">
            <label htmlFor="thread-rename-input" className="sr-only">
              Thread name
            </label>
            <input
              id="thread-rename-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Thread name"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
