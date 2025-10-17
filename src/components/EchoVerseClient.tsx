
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
  doc,
  getDocs,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ref as storageRef,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { useStorage } from "@/firebase/storage/use-storage";
import { useDatabase } from "@/firebase/database/use-database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  type User,
  type FriendRequest,
  type Friend,
  type Message
} from "@/lib/firebase/schema";
import { type User as FirebaseUser } from "firebase/auth";
import Settings from "./Settings";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset, SidebarFooter } from "./ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { LoadingSpinner } from "./LoadingSpinner";
import { useCallStore } from "@/hooks/use-call-store";
import CallModal from "./call/CallModal";
import { Mic, Phone, PhoneOff, UserPlus, BellRing, Cog, PanelLeft, MessageSquare, Search, Send, SettingsIcon, Paperclip, Smile } from "lucide-react";
import { ref, onValue, off } from "firebase/database";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import Image from "next/image";
import { Progress } from "./ui/progress";


export default function EchoVerseClient({ user, profile }: { user: FirebaseUser, profile: User }) {
  const [activeChat, setActiveChat] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);


  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const db = useDatabase();
  const { startCall, setIncomingCall } = useCallStore();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const roomId = activeChat ? [user.uid, activeChat.uid].sort().join('_') : null;

  // Listen for incoming calls
  useEffect(() => {
    if (!user || !db) return;
    const userCallsRef = ref(db, `calls/${user.uid}`);
    const listener = onValue(userCallsRef, (snapshot) => {
        const callData = snapshot.val();
        if (snapshot.exists() && callData.status === 'ringing' && callData.calleeId === user.uid) {
            setIncomingCall({
                roomId: callData.roomId,
                caller: callData.caller,
                status: 'ringing'
            });
        }
    });
    return () => off(userCallsRef, 'value', listener);
  }, [user, db, setIncomingCall]);


  useEffect(() => {
    if (!user || !firestore) return;

    const friendsQuery = query(collection(firestore, 'users', user.uid, 'friends'));
    const friendsUnsubscribe = onSnapshot(friendsQuery, (snapshot) => {
      const friendsList = snapshot.docs.map(doc => doc.data() as Friend);
      setFriends(friendsList);
    });

    const requestsQuery = query(collection(firestore, 'users', user.uid, 'requests'));
    const requestsUnsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsList = snapshot.docs.map(doc => doc.data() as FriendRequest);
      setFriendRequests(requestsList);
    });

    const sentRequestsQuery = query(collection(firestore, 'users', user.uid, 'sentRequests'));
    const sentRequestsUnsubscribe = onSnapshot(sentRequestsQuery, (snapshot) => {
      const sentToList = snapshot.docs.map(doc => doc.id);
      setSentRequests(sentToList);
    });

    return () => {
      friendsUnsubscribe();
      requestsUnsubscribe();
      sentRequestsUnsubscribe();
    }
  }, [user, firestore]);
  
  useEffect(() => {
    const handleSearch = async () => {
      if (!firestore || !searchQuery) {
        setSearchResults([]);
        return;
      };
      setIsSearching(true);
      const usersRef = collection(firestore, "users");
      const lowerCaseQuery = searchQuery.toLowerCase();
  
      // Query for username
      const usernameQuery = query(usersRef, 
        where("username", ">=", lowerCaseQuery),
        where("username", "<=", lowerCaseQuery + "\uf8ff")
      );
      
      // Query for fullname
      const fullnameQuery = query(usersRef, 
        where("fullname", ">=", searchQuery),
        where("fullname", "<=", searchQuery + "\uf8ff")
      );

      try {
        const [usernameSnapshot, fullnameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(fullnameQuery)
        ]);
        
        const usersMap = new Map<string, User>();
        
        usernameSnapshot.forEach((doc) => {
            const userData = doc.data() as User;
            if (userData.uid !== user.uid) {
                usersMap.set(userData.uid, userData);
            }
        });

        fullnameSnapshot.forEach((doc) => {
            const userData = doc.data() as User;
            if (userData.uid !== user.uid) {
                usersMap.set(userData.uid, userData);
            }
        });

        setSearchResults(Array.from(usersMap.values()));
      } catch (error) {
        console.error("Error searching for users:", error);
        toast({ variant: "destructive", title: "Search Error", description: "Could not perform search." });
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounceTimeout = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, firestore, user.uid, toast]);


  const sendFriendRequest = async (toUser: User) => {
    if (!firestore || !user || !profile) return;

    if (toUser.uid === user.uid) {
        toast({ variant: "destructive", title: "Cannot add yourself" });
        return;
    }
    if (friends.some(friend => friend.uid === toUser.uid)) {
        toast({ variant: "destructive", title: "Already friends" });
        return;
    }
    if (sentRequests.includes(toUser.uid)) {
        toast({ variant: "destructive", title: "Request already sent" });
        return;
    }
    
    const batch = writeBatch(firestore);
    const requestRef = doc(firestore, 'users', toUser.uid, 'requests', user.uid);
    batch.set(requestRef, { from: user.uid, username: profile.username, fullname: profile.fullname, ts: serverTimestamp() });
    const sentRequestRef = doc(firestore, 'users', user.uid, 'sentRequests', toUser.uid);
    batch.set(sentRequestRef, { to: toUser.uid });
    
    await batch.commit();
    toast({ title: "Friend Request Sent" });
  };

  const handleFriendRequest = async (request: FriendRequest, accept: boolean) => {
    if (!firestore || !user || !profile) return;
    const batch = writeBatch(firestore);
    const requestRef = doc(firestore, 'users', user.uid, 'requests', request.from);
    batch.delete(requestRef);
    const sentRequestRef = doc(firestore, 'users', request.from, 'sentRequests', user.uid);
    batch.delete(sentRequestRef);
    if (accept) {
      const userFriendRef = doc(firestore, 'users', user.uid, 'friends', request.from);
      batch.set(userFriendRef, { uid: request.from, username: request.username, fullname: request.fullname, since: serverTimestamp() });
      const newFriendRef = doc(firestore, 'users', request.from, 'friends', user.uid);
      batch.set(newFriendRef, { uid: user.uid, username: profile.username, fullname: profile.fullname, since: serverTimestamp() });
    }
    await batch.commit();
    toast({ title: accept ? "Friend Added" : "Request Declined" });
  };
  
  const handleStartCall = () => {
    if (!activeChat) return;
    const roomId = [user.uid, activeChat.uid].sort().join('_');
    startCall({
      caller: profile,
      callee: activeChat,
      roomId: roomId,
      status: 'outgoing'
    });
  }

  useEffect(() => {
    if (!roomId || !firestore) {
      setMessages([]);
      return;
    }
    setIsChatLoading(true);
    const q = query(collection(firestore, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setIsChatLoading(false);
    }, (error) => {
        console.error("Error fetching messages:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load messages." });
        setIsChatLoading(false);
    });
    return () => unsubscribe();
  }, [roomId, firestore, toast]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !roomId || !firestore) return;
    await addDoc(collection(firestore, 'rooms', roomId, 'messages'), {
      from: user.uid,
      text: newMessage,
      type: 'text',
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
    scrollToBottom();
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || !storage || !firestore) return;

    setIsUploading(true);
    setUploadProgress(0);

    const fileType = file.type.split('/')[0];
    let messageType: Message['type'] = 'image';
    if (fileType === 'video') messageType = 'video';
    else if (file.type === 'image/gif') messageType = 'gif';

    const sRef = storageRef(storage, `chat-media/${roomId}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(sRef, file);

    uploadTask.on(
        "state_changed",
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
        },
        (error) => {
            console.error("Error uploading file:", error);
            toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload your file." });
            setIsUploading(false);
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                await addDoc(collection(firestore, 'rooms', roomId, 'messages'), {
                    from: user.uid,
                    text: '',
                    type: messageType,
                    mediaUrl: downloadURL,
                    createdAt: serverTimestamp(),
                });
            }).finally(() => {
                setIsUploading(false);
                setUploadProgress(0);
                if(fileInputRef.current) fileInputRef.current.value = "";
            });
        }
    );
  };


  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
        case 'image':
        return (
            <Image
                src={msg.mediaUrl!}
                alt="Sent image"
                width={300}
                height={300}
                className="rounded-lg object-cover cursor-pointer"
                onClick={() => window.open(msg.mediaUrl, '_blank')}
            />
        );
        case 'video':
        return (
            <video
                src={msg.mediaUrl!}
                controls
                className="rounded-lg max-w-xs"
            />
        );
        case 'gif':
            return (
                <Image
                    src={msg.mediaUrl!}
                    alt="Sent GIF"
                    width={250}
                    height={200}
                    unoptimized
                    className="rounded-lg object-cover"
                />
            );
      default:
        return <p className="text-sm">{msg.text}</p>;
    }
  };
  
  return (
    <>
      <CallModal currentUser={profile}/>

      <Sidebar side="left" collapsible="icon" variant="sidebar">
        <SidebarHeader>
             <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatarUrl || undefined} />
                        <AvatarFallback>{profile.fullname.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                        <p className="font-semibold text-base text-sidebar-primary-foreground">{profile.fullname}</p>
                        <p className="text-sm text-sidebar-primary-foreground/80">@{profile.username}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <Dialog>
                        <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full transition-transform hover:scale-110">
                                        <UserPlus />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Add Friends</p></TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                        <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Friends</DialogTitle>
                        </DialogHeader>
                        <div className="flex gap-2">
                            <Input placeholder="Search by username or name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            <Button><Search/></Button>
                        </div>
                        <ScrollArea className="h-64">
                            <div className="space-y-4 py-4">
                            {isSearching ? (
                                <div className="flex justify-center items-center h-full">
                                <LoadingSpinner />
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(u => (
                                <div key={u.uid} className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                        <AvatarImage src={u.avatarUrl || undefined} />
                                        <AvatarFallback>{u.fullname.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                        <p className="font-semibold text-base">{u.fullname}</p>
                                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => sendFriendRequest(u)} disabled={sentRequests.includes(u.uid) || friends.some(f => f.uid === u.uid)}>
                                    {sentRequests.includes(u.uid) ? 'Sent' : 'Add'}
                                    </Button>
                                </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-center">No users found.</p>
                            )}
                            </div>
                        </ScrollArea>
                        </DialogContent>
                    </Dialog>
                    <Dialog>
                       <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full transition-transform hover:scale-110">
                                        <BellRing />
                                        {friendRequests.length > 0 && <Badge className="absolute top-1 right-1 h-5 w-5 p-0 justify-center">{friendRequests.length}</Badge>}
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Friend Requests</p></TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Friend Requests</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-64">
                                <div className="space-y-4 py-4">
                                    {friendRequests.map(req => (
                                        <div key={req.from} className="flex justify-between items-center">
                                            <p>{req.fullname} (@{req.username})</p>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleFriendRequest(req, false)}>Decline</Button>
                                                <Button size="sm" onClick={() => handleFriendRequest(req, true)}>Accept</Button>
                                            </div>
                                        </div>
                                    ))}
                                    {friendRequests.length === 0 && <p className="text-muted-foreground text-center">No new requests.</p>}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </SidebarHeader>

        <SidebarContent>
          <Separator className="my-2 bg-sidebar-border" />
          
          <SidebarMenu>
            <SidebarMenuItem>
              <p className="px-2 text-xs font-semibold text-sidebar-primary-foreground/70">Chats</p>
            </SidebarMenuItem>
            {friends.map(friend => (
              <SidebarMenuItem key={friend.uid}>
                <SidebarMenuButton onClick={() => setActiveChat(friend)} isActive={activeChat?.uid === friend.uid}>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-xs">{friend.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{friend.fullname}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start h-12 transition-transform hover:scale-105">
                    <SettingsIcon className="mr-2" /> Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-full">
                <Settings user={user} profile={profile} />
            </DialogContent>
            </Dialog>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset>
        <div className="flex flex-col h-screen">
            {activeChat ? (
            <>
                <header className="p-4 border-b flex justify-between items-center bg-background shadow-sm">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger className="md:hidden" />
                    <Avatar>
                      <AvatarImage src={undefined} />
                      <AvatarFallback>{activeChat.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h2 className="font-semibold">{activeChat.fullname}</h2>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleStartCall} className="rounded-full h-10 w-10 transition-transform hover:scale-110">
                                    <Phone />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Start Call</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </div>
                </header>
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  {isChatLoading ? (
                     <div className="flex justify-center items-center h-full">
                        <LoadingSpinner />
                     </div>
                  ) : messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.from === user.uid ? 'justify-end' : 'justify-start'}`}>
                          {msg.from !== user.uid && (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="text-xs">{activeChat.username.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`rounded-lg p-2 max-w-md break-words ${msg.from === user.uid ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                            {renderMessageContent(msg)}
                            <p className="text-xs text-right mt-1 opacity-70">{msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <MessageSquare size={40} className="mb-4" />
                        <p className="font-semibold">No messages yet.</p>
                        <p className="text-sm">Be the first to say something!</p>
                    </div>
                  )}
                </ScrollArea>
                <footer className="p-4 border-t bg-background">
                  {isUploading && (
                        <div className="flex items-center gap-2 mb-2">
                           <Progress value={uploadProgress} className="w-full" />
                           <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                        </div>
                    )}
                  <form onSubmit={sendMessage} className="flex gap-2 items-center">
                        <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*,video/*,image/gif"
                            disabled={isUploading}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                        <Paperclip />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Attach File</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" disabled={isUploading}>
                                    <Smile />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-0">
                                <EmojiPicker onEmojiClick={handleEmojiClick} />
                            </PopoverContent>
                        </Popover>
                      
                      <Input 
                          value={newMessage} 
                          onChange={(e) => setNewMessage(e.target.value)} 
                          placeholder={isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Type a message..."}
                          className="flex-1"
                          disabled={isUploading}
                      />
                      <Button type="submit" size="icon" disabled={!newMessage.trim() || isUploading}>
                          <Send/>
                          <span className="sr-only">Send</span>
                      </Button>
                  </form>
                </footer>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-4">
                 <div className="flex items-center md:hidden">
                    <SidebarTrigger />
                 </div>
                <div className="p-4 border rounded-full bg-muted">
                    <MessageSquare size={48} className="text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Welcome to EchoVerse!</h2>
                <p className="text-muted-foreground max-w-md">Your real-time communication hub. Select a friend from the sidebar to start a conversation, or add new friends to begin your journey.</p>
            </div>
            )}
        </div>
      </SidebarInset>
    </>
  );
}
