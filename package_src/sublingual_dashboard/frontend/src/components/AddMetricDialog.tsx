import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import { API_BASE_URL } from '@/config';

interface NewMetric {
    name: string;
    prompt: string;
    tool_type: string;
    min_val: number;
    max_val: number;
}

interface AddMetricDialogProps {
    onMetricAdded: () => void;
}

export function AddMetricDialog({ onMetricAdded }: AddMetricDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newMetric, setNewMetric] = useState<NewMetric>({
        name: '',
        prompt: '',
        tool_type: 'int',
        min_val: 0,
        max_val: 100
    });
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_BASE_URL}/metrics/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newMetric)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add metric');
            }

            toast({
                title: "Success",
                description: "New metric added successfully",
            });
            setIsOpen(false);
            onMetricAdded();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to add metric",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Metric</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add New Evaluation Metric</DialogTitle>
                    <DialogDescription>
                        Create a new metric for evaluating LLM responses
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="name">Name</Label>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger type="button" asChild>
                                        <HelpCircle className="h-4 w-4 text-gray-500" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>A short, descriptive name for the metric that will appear in the UI</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Input
                            id="name"
                            value={newMetric.name}
                            onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Response Quality"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="prompt">Evaluation Prompt</Label>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger type="button" asChild>
                                        <HelpCircle className="h-4 w-4 text-gray-500" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>The prompt that will be given to the LLM to evaluate this metric</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Textarea
                            id="prompt"
                            value={newMetric.prompt}
                            onChange={(e) => setNewMetric(prev => ({ ...prev, prompt: e.target.value }))}
                            placeholder="Describe how to evaluate this metric..."
                            className="min-h-[200px]"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="tool_type">Evaluation Type</Label>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger type="button" asChild>
                                        <HelpCircle className="h-4 w-4 text-gray-500" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>Choose whether this metric should be evaluated as a number or a yes/no question</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Select
                            value={newMetric.tool_type}
                            onValueChange={(value) => setNewMetric(prev => ({ ...prev, tool_type: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select evaluation type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="int">Numeric Score</SelectItem>
                                <SelectItem value="bool">Yes/No</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {newMetric.tool_type === 'int' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="min_val">Minimum Value</Label>
                                <Input
                                    id="min_val"
                                    type="number"
                                    value={newMetric.min_val}
                                    onChange={(e) => setNewMetric(prev => ({ ...prev, min_val: parseInt(e.target.value) }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_val">Maximum Value</Label>
                                <Input
                                    id="max_val"
                                    type="number"
                                    value={newMetric.max_val}
                                    onChange={(e) => setNewMetric(prev => ({ ...prev, max_val: parseInt(e.target.value) }))}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <Button type="submit" className="w-full">Add Metric</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
} 