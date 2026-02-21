import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Board, BoardRole, boardApi, getRoleBadgeColor, getRoleLabel } from "@/lib/api";
import { toast } from "sonner";
import { X, Loader2, Crown } from "lucide-react";

interface ShareDialogProps {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: BoardRole;
  onMemberAdded: (board: Board) => void;
  onMemberRemoved: (board: Board) => void;
  onRoleChanged: (board: Board) => void;
}

export function ShareDialog({
  board,
  isOpen,
  onClose,
  currentUserRole,
  onMemberAdded,
  onMemberRemoved,
  onRoleChanged,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<BoardRole>("member");
  const [isAdding, setIsAdding] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  const handleAddMember = async () => {
    if (!email.trim() || !isAdmin) return;

    setIsAdding(true);
    try {
      const updatedBoard = await boardApi.addMember(board._id, email.trim(), selectedRole) as Board;
      onMemberAdded(updatedBoard);
      setEmail("");
      setSelectedRole("member");
      toast.success("Member added successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: BoardRole) => {
    if (!isAdmin) return;

    setChangingRoleMemberId(userId);
    try {
      const updatedBoard = await boardApi.updateMemberRole(board._id, userId, newRole) as Board;
      onRoleChanged(updatedBoard);
      toast.success("Role updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    } finally {
      setChangingRoleMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingMemberId(userId);
    try {
      const updatedBoard = await boardApi.removeMember(board._id, userId) as Board;
      onMemberRemoved(updatedBoard);
      toast.success("Member removed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const isOwner = (userId: string) => board.owner._id === userId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#0F172A]">
            Share board
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite section - admin only */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#475569]">
                Invite member
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  className="flex-1"
                />
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as BoardRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={isAdding || !email.trim()}
                  className="bg-[#6366F1] hover:bg-[#4F46E5]"
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#475569]">
              Members ({board.members.length})
            </label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {board.members.map((member) => (
                <div
                  key={member.user._id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${getRoleBadgeColor(member.role)}, ${getRoleBadgeColor(member.role)}dd)`,
                    }}
                  >
                    {member.user.username.charAt(0).toUpperCase()}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {member.user.username}
                      </p>
                      {isOwner(member.user._id) && (
                        <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />
                      )}
                    </div>
                    <p className="text-xs text-[#475569] truncate">
                      {member.user.email}
                    </p>
                  </div>

                  {/* Role badge/selector */}
                  <div className="flex items-center gap-2">
                    {isAdmin && !isOwner(member.user._id) ? (
                      <Select
                        value={member.role}
                        onValueChange={(newRole) => handleRoleChange(member.user._id, newRole as BoardRole)}
                        disabled={changingRoleMemberId === member.user._id}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                          <SelectItem value="observer">Observer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getRoleBadgeColor(member.role) }}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    )}

                    {/* Remove button - admins can remove others, anyone can leave */}
                    {(isAdmin || member.user._id === board.owner._id) && !isOwner(member.user._id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user._id)}
                        disabled={removingMemberId === member.user._id}
                        className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                      >
                        {removingMemberId === member.user._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info text */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-[#64748B]">
              {isAdmin
                ? "As an admin, you can invite members and manage their roles."
                : "Contact an admin to invite new members or change roles."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
