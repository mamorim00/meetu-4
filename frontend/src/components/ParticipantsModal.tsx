import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "../utils/activityStore";
import { useUserProfileStore } from "../utils/userProfileStore";

interface Props {
  activity: Activity;
  isOpen: boolean;
  onClose: () => void;
}

export const ParticipantsModal: React.FC<Props> = ({ activity, isOpen, onClose }) => {
  const [participants, setParticipants] = React.useState<Array<{id: string, name: string, photoURL: string | null}>>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Load participant data when the modal opens
  React.useEffect(() => {
    const loadParticipants = async () => {
      if (!isOpen || !activity.participantIds?.length) {
        setParticipants([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // For now, we'll just use the creator's info and placeholder data
        // In a real app, we would fetch each participant's profile from Firestore
        const creatorInfo = {
          id: activity.createdBy.userId,
          name: activity.createdBy.displayName,
          photoURL: null
        };
        
        // Add placeholder data for other participants
        const otherParticipants = activity.participantIds
          .filter(id => id !== activity.createdBy.userId)
          .map(id => ({
            id,
            name: `Participant ${id.substring(0, 5)}...`,
            photoURL: null
          }));
        
        setParticipants([creatorInfo, ...otherParticipants]);
      } catch (error) {
        console.error('Error loading participants:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadParticipants();
  }, [isOpen, activity]);
  
  // Generate initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Activity Participants</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <p>Loading participants...</p>
            </div>
          ) : participants.length > 0 ? (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div 
                    key={participant.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10"
                  >
                    <Avatar>
                      {participant.photoURL ? (
                        <AvatarImage src={participant.photoURL} alt={participant.name} />
                      ) : null}
                      <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      {participant.id === activity.createdBy.userId && (
                        <p className="text-xs text-muted-foreground">Organizer</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No participants yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
