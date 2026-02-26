const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/kitchen`;
const imageUrl = `${appUrl}/kitchen/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>Kitchen | GuiltFree</title>
      <meta name="description" content="Build your personal kitchen and use saved items while logging meals." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="Kitchen | GuiltFree" />
      <meta property="og:description" content="Build your personal kitchen and use saved items while logging meals." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Kitchen | GuiltFree" />
      <meta name="twitter:description" content="Build your personal kitchen and use saved items while logging meals." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
