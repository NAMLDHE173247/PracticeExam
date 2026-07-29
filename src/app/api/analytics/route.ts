import { NextResponse } from "next/server";
import { getAnalytics } from "../../../modules/analytics/analytics.service";
import { ApiError } from "../../../lib/api/response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const subjectId = searchParams.get("subjectId") || undefined;

    if (!userId) {
      throw new ApiError("VALIDATION_ERROR", "Thiếu userId");
    }

    const data = await getAnalytics(userId, subjectId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi hệ thống." } },
      { status: 500 }
    );
  }
}
