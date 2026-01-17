
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Ensure a username exists for the community demo
if (!localStorage.getItem("paw_username")) {
  localStorage.setItem(
    "paw_username",
    "user_" + Math.floor(Math.random() * 10000)
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
