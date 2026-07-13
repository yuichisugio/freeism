export function ProblemBanner({ message }: Readonly<{ message: string }>) {
  return (
    <p className="problem-banner" role="alert">
      {message}
    </p>
  );
}
