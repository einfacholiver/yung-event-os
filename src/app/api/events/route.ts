import { NextResponse } from "next/server";
import { requireSameOrigin, mutationError } from "@/server/http";
import {
  createEventWithFolders,
  EventSetupError,
} from "@/modules/events/server/create-event";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const event = await createEventWithFolders(
      Object.fromEntries(await request.formData()),
    );
    return NextResponse.json({ success: true, id: event.id }, { status: 201 });
  } catch (error) {
    if (error instanceof EventSetupError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return mutationError(error);
  }
}
