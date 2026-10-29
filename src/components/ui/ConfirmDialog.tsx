"use client";

import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <span className="sr-only">{description}</span>
    </Modal>
  );
}
