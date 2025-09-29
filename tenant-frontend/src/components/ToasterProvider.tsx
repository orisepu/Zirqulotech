"use client";

import { ToastContainer } from "react-toastify";

export default function ToasterProvider() {
  return <ToastContainer position="bottom-right" autoClose={3000} />;
}
