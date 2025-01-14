export default function Home() {
  return (
    <div>
      <header></header>

      <main>
        <iframe
          src="https://docs.google.com/document/d/e/2PACX-1vSv2DzoMvPnYK4EQQn2q8jwSch9-YV3LrNUC42CcFxJoM4lWWfw_C6BbCtLxwHVTiw-FITAF1U1rl0u/pub?embedded=true"
          width="100%"
          height="1000"
        ></iframe>
      </main>

      <footer>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
