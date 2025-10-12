
"use client";

import { useCallStore } from "@/hooks/use-call-store";
import IncomingCall from "./IncomingCall";
import OutgoingCall from "./OutgoingCall";
import InCallView from "./InCallView";
import { type User } from "@/lib/firebase/schema";

interface CallModalProps {
    currentUser: User;
}

const CallModal = ({ currentUser }: CallModalProps) => {
    const { call, incomingCall } = useCallStore();

    const activeCall = call || incomingCall;

    if (!activeCall) {
        return null;
    }
    
    const isOutgoing = activeCall.status === 'outgoing';
    const isIncomingRinging = activeCall.status === 'ringing';
    const isInCall = activeCall.status === 'connected';


    if (isOutgoing) {
        return <OutgoingCall call={activeCall} />;
    }
    if (isIncomingRinging) {
        return <IncomingCall call={activeCall} currentUser={currentUser} />;
    }
    if (isInCall) {
        return <InCallView call={activeCall} />;
    }

    return null;
};

export default CallModal;
