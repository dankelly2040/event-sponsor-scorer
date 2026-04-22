import { useEffect } from "react";
import { Slot } from "expo-router";
import Head from "expo-router/head";

export default function Layout() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "auto";
    }
  }, []);

  return (
    <>
      <Head>
        <title>Sponsor Score - Should I sponsor this event?</title>
        <meta
          name="description"
          content="Upload your target account list and an event's attendee list. Get a score based on account overlap and contact quality. All processing happens in your browser."
        />
        <meta property="og:title" content="Sponsor or nah?" />
        <meta
          property="og:description"
          content="Score any event in seconds. Upload two lists, get an instant sponsorship recommendation."
        />
        <meta
          property="og:image"
          content="https://event-sponsor-scorer.expo.app/assets/og-image.png"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://event-sponsor-scorer.expo.app"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Sponsor or nah?" />
        <meta
          name="twitter:description"
          content="Score any event in seconds. Upload two lists, get an instant sponsorship recommendation."
        />
        <meta
          name="twitter:image"
          content="https://event-sponsor-scorer.expo.app/assets/og-image.png"
        />
      </Head>
      <Slot />
    </>
  );
}
