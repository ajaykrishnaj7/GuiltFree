const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/goals`;
const imageUrl = `${appUrl}/goals/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>Goals | GuiltFree</title>
      <meta name="description" content="Set calorie and macro goals aligned to your focus and activity." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="Goals | GuiltFree" />
      <meta property="og:description" content="Set calorie and macro goals aligned to your focus and activity." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Goals | GuiltFree" />
      <meta name="twitter:description" content="Set calorie and macro goals aligned to your focus and activity." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
