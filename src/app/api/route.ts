function getUser() {
  return {
    id: 1,
    name: "John Doe",
  };
}

export async function GET(request: Request) {
  const user = getUser();
  return NextResponse.json(user);
}
