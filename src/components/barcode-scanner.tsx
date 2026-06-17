import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResult: (code: string) => void;
};

export function BarcodeScanner({ open, onOpenChange, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);
        const back = list.find((d) => /back|rear|environment/i.test(d.label)) ?? list[list.length - 1];
        const id = deviceId ?? back?.deviceId;
        setDeviceId(id);
        if (!videoRef.current) return;
        controlsRef.current = await reader.decodeFromVideoDevice(id, videoRef.current, (result, err, controls) => {
          if (result) {
            controls.stop();
            onResult(result.getText());
            onOpenChange(false);
          }
        });
      } catch (e: any) {
        toast.error("تعذر فتح الكاميرا", { description: e?.message });
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> مسح الباركود</DialogTitle>
        </DialogHeader>
        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        </div>
        {devices.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {devices.map((d) => (
              <Button key={d.deviceId} size="sm" variant={d.deviceId === deviceId ? "default" : "outline"}
                onClick={() => setDeviceId(d.deviceId)}>
                {d.label || "كاميرا"}
              </Button>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4 ml-1" />إغلاق</Button>
      </DialogContent>
    </Dialog>
  );
}