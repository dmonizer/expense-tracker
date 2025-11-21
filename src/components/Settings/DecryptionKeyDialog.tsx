import {useState} from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';

interface DecryptionKeyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (key: string) => void;
    isRestoring: boolean;
}

export function DecryptionKeyDialog({
                                        open,
                                        onOpenChange,
                                        onConfirm,
                                        isRestoring,
                                    }: DecryptionKeyDialogProps) {
    const [key, setKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    const handleConfirm = () => {
        if (key) {
            onConfirm(key);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Enter Decryption Key</DialogTitle>
                    <DialogDescription>
                        This backup is encrypted. Please enter the decryption key to restore it.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="decryption-key">Decryption Key</Label>
                        <div className="flex space-x-2">
                            <Input
                                id="decryption-key"
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="Enter key..."
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && key && !isRestoring) {
                                        handleConfirm();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setShowKey(!showKey)}
                                className="px-3"
                            >
                                {showKey ? '🙈' : '👁️'}
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRestoring}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!key || isRestoring}>
                        {isRestoring ? 'Restoring...' : 'Decrypt & Restore'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
