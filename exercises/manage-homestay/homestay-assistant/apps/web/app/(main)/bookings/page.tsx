import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants";

import { BookingsPageClient } from "./bookings-page-client";

const BookingsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect(ROUTES.LOGIN);
  }

  return <BookingsPageClient userId={userId}/>;
};

export default BookingsPage;
