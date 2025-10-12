# EchoVerse: A Real-Time Communication App

This document outlines the features and functionalities of **EchoVerse**, a real-time communication web application built using Next.js, React, Firebase, and Tailwind CSS in Firebase Studio.

### Core Features

**EchoVerse** provides a seamless and interactive platform for users to connect and communicate. Here’s a breakdown of what the app can do:

1.  **User Authentication & Onboarding:**
    *   **Anonymous Sign-In:** The app automatically signs users in anonymously using Firebase Authentication, providing a unique identity without requiring traditional registration.
    *   **Profile Creation:** First-time users are guided through a simple onboarding process to create a user profile by providing a full name and a unique username. This information is securely stored in Firestore.

2.  **Real-Time Communication:**
    *   **Audio Calls:** Users can initiate one-on-one audio calls with their friends. The app uses WebRTC for peer-to-peer connection, with Firebase Realtime Database facilitating the signaling process (exchanging offers, answers, and ICE candidates).
    *   **Text Chat:** Alongside audio calls, users can engage in real-time text messaging. Chat messages are stored in Firestore and updated instantly across devices using real-time listeners (`onSnapshot`).

3.  **Friend Management System:**
    *   **User Search:** A powerful search feature allows users to find and connect with others by searching for either their username or full name.
    *   **Friend Requests:** Users can send, receive, accept, and decline friend requests. This system prevents duplicate requests, self-requests, and requests to existing friends.
    *   **Real-Time Updates:** The friend list and incoming request notifications update in real-time, thanks to Firestore's `onSnapshot` listeners.

4.  **Comprehensive Settings Panel:**
    *   **Profile Customization:** Users can personalize their profile by uploading an avatar. Images are uploaded to Firebase Storage, and the public URL is linked to their user profile in Firestore.
    *   **Account Management:** The settings panel allows users to update their full name and username, with built-in validation to ensure usernames remain unique. It also includes a secure sign-out option.
    *   **Privacy Controls:** Toggle switches are available for managing privacy preferences, such as online status visibility and the ability to receive friend requests (note: UI is present, but backend logic for enforcement is a future step).
    *   **Theme Switching:** Users can switch between a light and dark theme. The preference is saved in the browser's `localStorage` for a consistent experience across sessions.

### Technical Architecture

*   **Frontend:** Built with **Next.js** and **React**, utilizing functional components and hooks for a modern, efficient user interface.
*   **Styling:** Styled with **Tailwind CSS** for a utility-first approach and **ShadCN UI** for a set of pre-built, accessible, and customizable components.
*   **Database:**
    *   **Firestore:** Used as the primary database for storing user profiles, friend lists, friend requests, and chat messages. Its real-time capabilities are central to the app's interactive nature.
    *   **Firebase Realtime Database:** Specifically used for the low-latency signaling required to establish WebRTC connections for audio calls.
*   **Authentication:** **Firebase Authentication** handles secure and easy anonymous user sign-in.
*   **File Storage:** **Firebase Storage** is used for hosting user-uploaded profile pictures.
*   **Real-time Capabilities:** The entire application is built around a real-time model. User presence, chat messages, and notifications all update instantly without needing to refresh the page, creating a dynamic and engaging user experience.
