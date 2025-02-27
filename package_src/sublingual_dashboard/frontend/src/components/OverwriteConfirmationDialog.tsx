import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Metrics } from "@/types/metrics";

interface OverwriteConfirmationDialogProps {
    isOpen: boolean;
    existingEvals: Record<string, string[]>;
    onConfirm: () => void;
    onCancel: () => void;
    metrics: Metrics;
}

export function OverwriteConfirmationDialog({
    isOpen,
    existingEvals,
    onConfirm,
    onCancel,
    metrics
}: OverwriteConfirmationDialogProps) {
    return (
        <AlertDialog 
            open={isOpen} 
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Overwrite Existing Evaluations?</AlertDialogTitle>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <AlertDialogDescription>
                            The following criteria already have evaluations:
                        </AlertDialogDescription>
                        <ul className="list-disc list-inside">
                            {Object.entries(existingEvals).map(([criteria, runs]) => (
                                <li key={criteria}>
                                    {metrics[criteria].name} ({runs.length} evaluation{runs.length !== 1 ? 's' : ''})
                                </li>
                            ))}
                        </ul>
                        <AlertDialogDescription>
                            Do you want to overwrite these evaluations?
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Yes, Overwrite
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
} 