import { toast } from "react-toastify";

export const notifySuccess = (msg) => toast.success(msg);
export const notifyInfo = (msg) => toast.info(msg);
export const notifyWarn = (msg) => toast.warn(msg);

export const notifyError = (err, fallback = "Something went wrong") => {
  const msg =
    typeof err === "string"
      ? err
      : err?.response?.data
      ? typeof err.response.data === "string"
        ? err.response.data
        : err.response.data?.error || fallback
      : err?.message || fallback;

  toast.error(msg);
};