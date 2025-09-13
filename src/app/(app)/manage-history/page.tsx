'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Shield, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

import { listDrafts } from '@/ai/flows/list-drafts';
import { deleteDraft } from '@/ai/flows/delete-draft';
import { listHistory } from '@/ai/flows/list-history';
import { deleteHistory } from '@/ai/flows/delete-history';
import type { DraftSummary } from '@/lib/drafts-schema';
import type { HistoryRecord } from '@/lib/history-schema';

type CombinedRecord = (DraftSummary | HistoryRecord) & { type: 'draft' | 'history' };

const PASSWORD = '123456';

export default function ManageHistoryPage() {
  const { toast } = useToast();
  const [password, setPassword] = React.useState('');
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [records, setRecords] = React.useState<CombinedRecord[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState<CombinedRecord | null>(null);
  const [recordToView, setRecordToView] = React.useState<HistoryRecord | null>(null);

  const handleLogin = () => {
    if (password === PASSWORD) {
      setIsAuthenticated(true);
      fetchRecords();
    } else {
      toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Incorrect password.' });
    }
  };

  const fetchRecords = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [drafts, history] = await Promise.all([listDrafts(), listHistory()]);
      const combined: CombinedRecord[] = [
        ...drafts.map((d) => ({ ...d, type: 'draft' as const })),
        ...history.map((h) => ({ ...h, type: 'history' as const })),
      ];
      combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setRecords(combined);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error fetching records', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const openDeleteDialog = (record: CombinedRecord) => {
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const openViewDialog = (record: HistoryRecord) => {
    setRecordToView(record);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      if (recordToDelete.type === 'draft') {
        await deleteDraft({ draftId: recordToDelete.draftId });
      } else {
        await deleteHistory({ draftId: recordToDelete.draftId });
      }
      toast({ title: 'Success', description: `${recordToDelete.type.charAt(0).toUpperCase() + recordToDelete.type.slice(1)} record deleted.` });
      fetchRecords();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    } finally {
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please enter the password to manage records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Access
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">Manage Drafts & History</h1>
        <p className="text-muted-foreground">View and delete saved drafts and replacement history.</p>
      </header>
      <main>
        <Card>
          <CardHeader>
            <CardTitle>All Records</CardTitle>
            <CardDescription>Combined view of drafts and history, sorted by last update time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Property Address</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">No records found.</TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={`${record.type}-${record.draftId}`}>
                        <TableCell>
                          <Badge variant={record.type === 'draft' ? 'secondary' : 'outline'}>
                            {record.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{record.propertyAddress}</TableCell>
                        <TableCell>{format(new Date(record.updatedAt), 'dd MMM yyyy, HH:mm')}</TableCell>
                        <TableCell>
                          {'ifreplacetext' in record && (record.ifreplacetext || record.ifreplaceimage) ? (
                            <div className="flex flex-wrap gap-1">
                              {record.ifreplacetext && <Badge>Text</Badge>}
                              {record.ifreplaceimage && <Badge>Image</Badge>}
                            </div>
                          ) : (
                            record.type === 'draft' && <Badge variant="outline">Unprocessed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.type === 'history' && (
                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(record as HistoryRecord)}>
                               <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(record)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              <span className="font-bold"> {recordToDelete?.type}</span> record for 
              <span className="font-bold"> {recordToDelete?.propertyAddress}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>View History: {recordToView?.propertyAddress}</DialogTitle>
                <DialogDescription>
                    Snapshot of data from {recordToView ? format(new Date(recordToView.updatedAt), 'dd MMM yyyy, HH:mm') : ''}.
                </DialogDescription>
            </DialogHeader>
            <pre className="mt-4 p-4 bg-muted rounded-md text-xs overflow-auto">
                {JSON.stringify(recordToView?.data, null, 2)}
            </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
