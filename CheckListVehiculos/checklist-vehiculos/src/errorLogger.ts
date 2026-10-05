import api from "./api";

export interface PendingError {
  error: string;
  timestamp: string;
}

export const logError = async (errorObj: any) => {
  let errorMsg = "";
  if (errorObj instanceof Error) {
    errorMsg = errorObj.message;
  } else if (typeof errorObj === "string") {
    errorMsg = errorObj;
  } else {
    try {
      errorMsg = JSON.stringify(errorObj);
    } catch (e) {
      errorMsg = "Unknown error";
    }
  }

  const timestamp = new Date().toISOString();

  let user_id: string | undefined = undefined;
  const storedUser = localStorage.getItem("user_data");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      user_id = parsedUser.id;
    } catch (e) {
      // ignore
    }
  }

  try {
    await api.post("/error-logs", { user_id, error: errorMsg, timestamp });
  } catch (err) {
    // If backend is unreachable, save to localStorage
    const pendingErrorsStr = localStorage.getItem("pending_error_logs") || "[]";
    let pendingErrors: PendingError[] = [];
    try {
      pendingErrors = JSON.parse(pendingErrorsStr);
    } catch (e) {
      pendingErrors = [];
    }
    pendingErrors.push({ error: errorMsg, timestamp });
    localStorage.setItem("pending_error_logs", JSON.stringify(pendingErrors));
  }
};

export const syncPendingErrors = async () => {
  const pendingErrorsStr = localStorage.getItem("pending_error_logs");
  if (!pendingErrorsStr) return;

  let pendingErrors: PendingError[] = [];
  try {
    pendingErrors = JSON.parse(pendingErrorsStr);
  } catch (e) {
    return;
  }

  if (pendingErrors.length === 0) return;

  let user_id: string | undefined = undefined;
  const storedUser = localStorage.getItem("user_data");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      user_id = parsedUser.id;
    } catch (e) {
      // ignore
    }
  }

  const remainingErrors: PendingError[] = [];

  for (const pendingError of pendingErrors) {
    try {
      await api.post("/error-logs", {
        user_id,
        error: pendingError.error,
        timestamp: pendingError.timestamp,
      });
    } catch (err) {
      remainingErrors.push(pendingError);
    }
  }

  if (remainingErrors.length > 0) {
    localStorage.setItem("pending_error_logs", JSON.stringify(remainingErrors));
  } else {
    localStorage.removeItem("pending_error_logs");
  }
};
