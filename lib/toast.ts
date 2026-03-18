import { toast } from "sonner";

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  loading: (msg: string) => toast.loading(msg),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
