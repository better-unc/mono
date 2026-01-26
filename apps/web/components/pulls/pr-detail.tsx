import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  Comment01Icon,
  Tick02Icon,
  Cancel01Icon,
  Loading02Icon,
} from "@hugeicons-pro/core-stroke-standard";
import type { PullRequest, Label, Owner, PRDiff, PRReview } from "@gitbruv/hooks";
import { DiffViewer, DiffToolbar, type DiffViewMode } from "@/components/diff-viewer";
import { ReactionDisplay, LabelPicker, AssigneePicker } from "@/components/issues";
import { timeAgo } from "@gitbruv/lib";
import Markdown from "react-markdown";

interface PRDetailProps {
  pullRequest: PullRequest;
  labels: Label[];
  availableAssignees: Owner[];
  diffData?: PRDiff;
  isLoadingDiff: boolean;
  currentUserId?: string;
  isOwner: boolean;
  onToggleReaction: (emoji: string) => void;
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
  onAddReviewer: (userId: string) => void;
  onRemoveReviewer: (userId: string) => void;
  onSubmitReview: (data: { body?: string; state: "approved" | "changes_requested" | "commented" }) => void;
  isSubmittingReview: boolean;
}

export function PRDetail({
  pullRequest,
  labels,
  availableAssignees,
  diffData,
  isLoadingDiff,
  currentUserId,
  isOwner,
  onToggleReaction,
  onAddLabel,
  onRemoveLabel,
  onAddAssignee,
  onRemoveAssignee,
  onAddReviewer,
  onRemoveReviewer,
  onSubmitReview,
  isSubmittingReview,
}: PRDetailProps) {
  const [activeTab, setActiveTab] = useState("conversation");
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [fullWidth, setFullWidth] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  const canEdit = currentUserId === pullRequest.author.id || isOwner;
  const canReview = currentUserId && currentUserId !== pullRequest.author.id;

  const handleSubmitReview = (state: "approved" | "changes_requested" | "commented") => {
    onSubmitReview({ body: reviewBody || undefined, state });
    setReviewBody("");
    setShowReviewForm(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className={fullWidth && activeTab === "files" ? "lg:col-span-4" : "lg:col-span-3"}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="conversation" className="gap-2">
              <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-4" />
              Conversation
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4" />
              Files changed
              {diffData && (
                <span className="ml-1 text-muted-foreground">({diffData.stats.filesChanged})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="space-y-4">
            <div className="border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={pullRequest.author.avatarUrl || undefined} />
                  <AvatarFallback>{pullRequest.author.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{pullRequest.author.username}</span>
                <span className="text-muted-foreground text-sm">
                  opened {timeAgo(pullRequest.createdAt)}
                </span>
              </div>
              <div className="p-4">
                {pullRequest.body ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{pullRequest.body}</Markdown>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No description provided.</p>
                )}
              </div>
              {pullRequest.reactions.length > 0 && (
                <div className="px-4 pb-4">
                  <ReactionDisplay
                    reactions={pullRequest.reactions}
                    onToggle={onToggleReaction}
                    disabled={!currentUserId}
                  />
                </div>
              )}
            </div>

            {pullRequest.reviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Reviews</h3>
                {pullRequest.reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            {isLoadingDiff ? (
              <div className="flex items-center justify-center py-12">
                <HugeiconsIcon
                  icon={Loading02Icon}
                  strokeWidth={2}
                  className="size-8 animate-spin text-muted-foreground"
                />
              </div>
            ) : diffData ? (
              <>
                <DiffToolbar
                  stats={diffData.stats}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  fullWidth={fullWidth}
                  onFullWidthChange={setFullWidth}
                />
                <DiffViewer files={diffData.files} viewMode={viewMode} />
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Could not load diff
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {!(fullWidth && activeTab === "files") && (
        <div className="space-y-6">
          {canReview && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Review</h3>
              {showReviewForm ? (
                <div className="space-y-3 border border-border p-3">
                  <Textarea
                    placeholder="Leave a comment (optional)"
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    rows={3}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleSubmitReview("approved")}
                      disabled={isSubmittingReview}
                    >
                      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-red-600 border-red-300"
                      onClick={() => handleSubmitReview("changes_requested")}
                      disabled={isSubmittingReview}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 mr-1" />
                      Request changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSubmitReview("commented")}
                      disabled={isSubmittingReview}
                    >
                      Comment only
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowReviewForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowReviewForm(true)}
                >
                  Add your review
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Reviewers</h3>
            {pullRequest.reviewers.length > 0 ? (
              <div className="space-y-2">
                {pullRequest.reviewers.map((reviewer) => (
                  <div key={reviewer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={reviewer.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px]">{reviewer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{reviewer.username}</span>
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-muted-foreground"
                        onClick={() => onRemoveReviewer(reviewer.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reviewers</p>
            )}
            {canEdit && (
              <AssigneePicker
                availableAssignees={availableAssignees}
                selectedAssignees={pullRequest.reviewers}
                onAddAssignee={onAddReviewer}
                onRemoveAssignee={onRemoveReviewer}
                label="Add reviewer"
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Assignees</h3>
            {pullRequest.assignees.length > 0 ? (
              <div className="space-y-2">
                {pullRequest.assignees.map((assignee) => (
                  <div key={assignee.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={assignee.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px]">{assignee.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{assignee.username}</span>
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-muted-foreground"
                        onClick={() => onRemoveAssignee(assignee.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No one assigned</p>
            )}
            {canEdit && (
              <AssigneePicker
                availableAssignees={availableAssignees}
                selectedAssignees={pullRequest.assignees}
                onAddAssignee={onAddAssignee}
                onRemoveAssignee={onRemoveAssignee}
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Labels</h3>
            {pullRequest.labels.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {pullRequest.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                  >
                    {label.name}
                    {canEdit && (
                      <button
                        onClick={() => onRemoveLabel(label.id)}
                        className="ml-1 hover:opacity-80"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None yet</p>
            )}
            {canEdit && (
              <LabelPicker
                labels={labels}
                selectedLabels={pullRequest.labels}
                onAddLabel={onAddLabel}
                onRemoveLabel={onRemoveLabel}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewItem({ review }: { review: PRReview }) {
  const stateColors = {
    approved: "text-green-600 dark:text-green-400 bg-green-500/10",
    changes_requested: "text-red-600 dark:text-red-400 bg-red-500/10",
    commented: "text-muted-foreground bg-secondary/50",
  };

  const stateLabels = {
    approved: "Approved",
    changes_requested: "Changes requested",
    commented: "Commented",
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
        <Avatar className="h-5 w-5">
          <AvatarImage src={review.author.avatarUrl || undefined} />
          <AvatarFallback className="text-[10px]">{review.author.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm">{review.author.username}</span>
        <span className={`text-xs px-2 py-0.5 ${stateColors[review.state]}`}>
          {stateLabels[review.state]}
        </span>
        <span className="text-muted-foreground text-xs">{timeAgo(review.createdAt)}</span>
      </div>
      {review.body && (
        <div className="p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{review.body}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
