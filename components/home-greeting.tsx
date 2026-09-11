"use client";

import { useEffect, useState } from "react";

export function HomeGreeting({ name }: { name: string }) {
  const [hello, setHello] = useState("Hello");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setHello("Good morning");
    else if (hour < 18) setHello("Good afternoon");
    else setHello("Good evening");
  }, []);

  return (
    <h1 className="text-3xl font-semibold tracking-tight md:text-[2rem]">
      {hello}, {name}
    </h1>
  );
}
