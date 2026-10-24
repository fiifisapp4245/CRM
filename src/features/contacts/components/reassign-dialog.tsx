"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { OwnerSelect } from "@/components/forms/owner-select";
import { useAssignableOwners } from "../hooks/use-contacts";
import { reassignContacts } from "../services/contacts-service";

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  /** Pre-selected owner (single contact). */
  currentOwnerId?: string | null;
  subject: string;
  onDone?: () => void;
}

export function ReassignDialog(props: ReassignDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Content unmounts on close, so the form state starts fresh on every open. */}
        <ReassignBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ReassignBody({ onOpenChange, contactIds, currentOwnerId, subject, onDone }: ReassignDialogProps) {
  const owners = useAssignableOwners();
  const [ownerId, setOwnerId] = useState(currentOwnerId ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await reassignContacts(contactIds, ownerId || null);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    const name = owners.find((o) => o.id === ownerId)?.name ?? "Unassigned";
    toast.success(res.data.changed === 1 ? `Owner changed to ${name}` : `${res.data.changed} contacts assigned to ${name}`, {
      description: res.data.skipped ? `${res.data.skipped} skipped (already owned, archived or outside your access).` : undefined,
    });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Change owner</DialogTitle>
          <DialogDescription>Choose who is responsible for {subject}. The new owner is notified.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reassign-owner">New owner</Label>
          <OwnerSelect id="reassign-owner" value={ownerId} onChange={setOwnerId} owners={owners} />
          <p className="text-xs text-muted-foreground">Only active people in your organisation that you can assign to are listed.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || (contactIds.length === 1 && ownerId === (currentOwnerId ?? ""))}>
            {busy && <Loader2 className="animate-spin" />} Change owner
          </Button>
        </DialogFooter>
    </>
  );
}
