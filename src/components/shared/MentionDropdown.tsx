"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MentionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MentionDropdownProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
}

export function MentionDropdown({
  query,
  position,
  onSelect,
  onClose,
}: MentionDropdownProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch users matching the query
  useEffect(() => {
    if (query.length < 1) {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/v1/users/mentions?q=${encodeURIComponent(query)}`
        );
        const data = (await res.json()) as {
          success: boolean;
          data?: MentionUser[];
        };
        if (data.success && data.data) {
          setUsers(data.data);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error("Failed to fetch mention users:", error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 150);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % users.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (users[selectedIndex]) {
            onSelect(users[selectedIndex]);
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (users.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="bg-popover border-border absolute z-50 w-64 rounded-md border shadow-md"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {isLoading ? (
        <div className="text-muted-foreground p-3 text-sm">Searching...</div>
      ) : (
        <ul className="max-h-48 overflow-y-auto py-1">
          {users.map((user, index) => (
            <li
              key={user.id}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onClick={() => onSelect(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {user.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {user.displayName}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  @{user.username}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface UseMentionOptions {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

export function useMention({ inputRef, value, onChange }: UseMentionOptions) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const checkForMention = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Find the last @ symbol before cursor that's not part of a completed mention
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      setShowDropdown(false);
      return;
    }

    // Check if @ is at start or preceded by whitespace
    const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
    if (!/\s/.test(charBefore) && lastAtIndex !== 0) {
      setShowDropdown(false);
      return;
    }

    // Get the text after @ until cursor
    const mentionText = textBeforeCursor.substring(lastAtIndex + 1);

    // Check if mention text is valid (no spaces, alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]*$/.test(mentionText)) {
      setShowDropdown(false);
      return;
    }

    // We have a valid mention in progress
    setMentionQuery(mentionText);
    setMentionStart(lastAtIndex);
    setShowDropdown(true);

    // Calculate dropdown position
    if (input) {
      const rect = input.getBoundingClientRect();
      // Position below the input
      setDropdownPosition({
        top: rect.height + 4,
        left: 0,
      });
    }
  }, [value, inputRef]);

  useEffect(() => {
    checkForMention();
  }, [value, checkForMention]);

  const handleSelectUser = useCallback(
    (user: MentionUser) => {
      if (mentionStart === null) return;

      const input = inputRef.current;
      const cursorPos = input?.selectionStart || value.length;

      // Replace the @mention with the selected username
      const before = value.substring(0, mentionStart);
      const after = value.substring(cursorPos);
      const newValue = `${before}@${user.username} ${after}`;

      onChange(newValue);
      setShowDropdown(false);

      // Set cursor position after the mention
      setTimeout(() => {
        if (input) {
          const newCursorPos = mentionStart + user.username.length + 2; // +2 for @ and space
          input.setSelectionRange(newCursorPos, newCursorPos);
          input.focus();
        }
      }, 0);
    },
    [mentionStart, value, onChange, inputRef]
  );

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  return {
    showDropdown,
    mentionQuery,
    dropdownPosition,
    handleSelectUser,
    closeDropdown,
  };
}
