import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "SolvePath | Socratic AI Math Tutor",
  description: "Deterministic & Socratic AI Math Tutor for Secondary Education",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
