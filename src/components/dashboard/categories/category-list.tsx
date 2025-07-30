
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlusCircle,
  Tag,
  ShoppingBasket,
  Car,
  Home,
  Heart,
  BookOpen,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  X,
  Banknote,
  Briefcase,
  Gift,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import type { Category, SubCategory } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges, restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Map icon names to components
const iconComponents: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Tag,
  ShoppingBasket,
  Car,
  Home,
  Heart,
  BookOpen,
  Banknote,
  Briefcase,
  Gift,
};

const iconNames = Object.keys(iconComponents);

const getRandomIcon = () => {
  return iconNames[Math.floor(Math.random() * iconNames.length)];
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};


function SortableSubCategoryItem({ subCategory }: { subCategory: SubCategory }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subCategory.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'none',
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(badgeVariants({ variant: "secondary" }), "group relative flex justify-between items-center w-full h-auto py-1.5 px-2.5 touch-none")}>
        <div className="flex-1 flex items-center overflow-hidden gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab"/>
            <span className="truncate" title={subCategory.name}>{subCategory.name}</span>
        </div>
        <div className="flex items-center flex-shrink-0 pl-2">
            {subCategory.frequency === 'monthly' && subCategory.budget && subCategory.budget > 0 && <span className="text-xs font-mono text-muted-foreground mr-2">{formatCurrency(subCategory.budget)}</span>}
             {subCategory.frequency && <Badge variant="outline" className="capitalize text-xs hidden sm:inline-flex">{subCategory.frequency}</Badge>}
        </div>
    </div>
  );
}


function SortableCategoryCard({ 
  category, 
  onAddSubCategory,
  onEditCategory,
  onDeleteCategory,
  onEditSubCategory,
  onDeleteSubCategory,
  onSubCategoryOrderChange,
}: { 
  category: Category, 
  onAddSubCategory: (category: Category) => void,
  onEditCategory: (category: Category) => void,
  onDeleteCategory: (categoryId: string) => void,
  onEditSubCategory: (category: Category, subCategory: SubCategory) => void,
  onDeleteSubCategory: (category: Category, subCategory: SubCategory) => void,
  onSubCategoryOrderChange: (category: Category, newSubcategories: SubCategory[]) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const IconComponent = iconComponents[category.icon] || Tag;

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = category.subcategories.findIndex(s => s.id === active.id);
            const newIndex = category.subcategories.findIndex(s => s.id === over!.id);
            if (oldIndex === -1 || newIndex === -1) return;
            const reorderedSubcategories = arrayMove(category.subcategories, oldIndex, newIndex);
            onSubCategoryOrderChange(category, reorderedSubcategories);
        }
    }
    
    const totalBudget = useMemo(() => {
        if (category.type !== 'expense' || !category.subcategories) return 0;
        return category.subcategories
            .filter(sub => sub.frequency === 'monthly' && sub.budget)
            .reduce((acc, sub) => acc + (sub.budget || 0), 0);
    }, [category]);
    
    const monthlySubcategories = useMemo(() => category.subcategories?.filter(s => s.frequency === 'monthly') || [], [category.subcategories]);
    const occasionalSubcategories = useMemo(() => category.subcategories?.filter(s => s.frequency === 'occasional') || [], [category.subcategories]);


    const renderSubcategory = (sub: SubCategory) => (
        <div key={sub.id} className="relative group/sub">
            <SortableSubCategoryItem subCategory={sub} />
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/sub:opacity-100 transition-opacity bg-secondary">
                <button onClick={() => onEditSubCategory(category, sub)} className="p-0.5 hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                </button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button className="p-0.5 hover:text-destructive">
                            <X className="h-3 w-3" />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the "{sub.name}" subcategory. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteSubCategory(category, sub)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="flex flex-col h-full">
               <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <IconComponent className="h-6 w-6 text-muted-foreground mt-1" />
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    {totalBudget > 0 && <p className="text-sm font-medium text-primary">{formatCurrency(totalBudget)} / month</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                   <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => onAddSubCategory(category)}>
                          <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add Sub-category</TooltipContent>
                  </Tooltip>
                   <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" onClick={() => onEditCategory(category)}>
                          <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Category</TooltipContent>
                  </Tooltip>
                  <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Delete Category</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                              This will permanently delete the "{category.name}" category and all its subcategories. This action cannot be undone.
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteCategory(category.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <div {...attributes} {...listeners} className="touch-none p-2 cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-0 overflow-hidden">
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                >
                    <ScrollArea className="h-full max-h-48 pr-4">
                        <SortableContext items={category.subcategories?.map(s => s.id) || []} strategy={verticalListSortingStrategy}>
                            {category.type === 'expense' && monthlySubcategories.length > 0 && (
                                <>
                                <p className="text-xs font-semibold text-muted-foreground mb-1 mt-2">Monthly</p>
                                <div className="flex flex-col gap-2">
                                    {monthlySubcategories.map(renderSubcategory)}
                                </div>
                                </>
                            )}
                            {category.type === 'expense' && occasionalSubcategories.length > 0 && (
                                <>
                                <p className="text-xs font-semibold text-muted-foreground mb-1 mt-2">Occasional</p>
                                <div className="flex flex-col gap-2">
                                    {occasionalSubcategories.map(renderSubcategory)}
                                </div>
                                </>
                            )}
                             {(category.type !== 'expense' && category.subcategories?.length > 0) && (
                                <div className="flex flex-col gap-2">
                                    {category.subcategories.map(renderSubcategory)}
                                </div>
                            )}

                        </SortableContext>
                         {(!category.subcategories || category.subcategories.length === 0) && (
                            <p className="text-sm text-muted-foreground pt-2">No sub-categories yet.</p>
                        )}
                    </ScrollArea>
                </DndContext>
              </CardContent>
            </Card>
        </div>
    );
}


export function CategoryList({ categoryType }: { categoryType: 'expense' | 'bank' }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubCategoryDialogOpen, setIsSubCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [isEditSubCategoryDialogOpen, setIsEditSubCategoryDialogOpen] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);

  const [user, loading] = useAuthState(auth);
  const sensors = useSensors(useSensor(PointerSensor));

  const categoryIds = useMemo(() => categories.map(c => c.id), [categories]);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "categories"),
        where("userId", "==", user.uid),
        where("type", "==", categoryType),
        orderBy("order", "asc")
      );
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const userCategories: Category[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();

            let subcategories: SubCategory[] = [];
            // Handle new array format
            if (Array.isArray(data.subcategories)) {
                subcategories = data.subcategories;
            } else { // Handle old object format for backward compatibility
                const reservedFields = ['userId', 'name', 'icon', 'order', 'type'];
                Object.keys(data).forEach(key => {
                    if (!reservedFields.includes(key) && typeof data[key] === 'object' && data[key] !== null && 'name' in data[key]) {
                        subcategories.push({
                            id: key, // Use the field key as the ID
                            ...data[key]
                        } as SubCategory);
                    }
                });
            }

            userCategories.push({
                id: doc.id,
                userId: data.userId,
                name: data.name,
                icon: data.icon,
                order: data.order,
                type: data.type,
                subcategories: subcategories.sort((a,b) => (a.order || 0) - (b.order || 0)),
            });
          });
          setCategories(userCategories);
        },
        (error) => {
        }
      );
      return () => unsubscribe();
    }
  }, [user, categoryType, db]);

  const handleAddCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const formData = new FormData(event.currentTarget);
    const newCategory = {
      userId: user.uid,
      name: formData.get("name") as string,
      icon: getRandomIcon(),
      subcategories: [],
      order: categories.length,
      type: categoryType,
    };

    try {
      await addDoc(collection(db, "categories"), newCategory);
      setIsCategoryDialogOpen(false);
    } catch (error) {
    }
  };

  const handleEditCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedCategory) return;
    const formData = new FormData(event.currentTarget);
    const newName = formData.get("name") as string;
    try {
        const categoryRef = doc(db, "categories", selectedCategory.id);
        await updateDoc(categoryRef, { name: newName });
        setIsEditCategoryDialogOpen(false);
        setSelectedCategory(null);
    } catch (error) {
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if(!user) return;
    try {
        await deleteDoc(doc(db, "categories", categoryId));
    } catch (error) {
    }
  }

  const handleAddSubCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedCategory) return;

    const formData = new FormData(event.currentTarget);
    const existingSubcategories = selectedCategory.subcategories || [];
    const newSubCategory: SubCategory = {
      id: new Date().getTime().toString() + Math.random().toString(36).substring(2, 9), // simple unique id
      name: formData.get("name") as string,
      frequency: categoryType === 'expense' ? (formData.get("frequency") as 'monthly' | 'occasional' || 'occasional') : undefined,
      order: existingSubcategories.length,
    }
    
    if (categoryType === 'expense') {
        const budget = parseFloat(formData.get("budget") as string);
        if (!isNaN(budget) && budget > 0) {
            newSubCategory.budget = budget;
        }
    }

    try {
      const categoryRef = doc(db, "categories", selectedCategory.id);
      await updateDoc(categoryRef, {
        subcategories: [...existingSubcategories, newSubCategory],
      });
      setIsSubCategoryDialogOpen(false);
      setSelectedCategory(null);
    } catch (error) {
    }
  };

  const handleEditSubCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedCategory || !selectedSubCategory) return;

    const formData = new FormData(event.currentTarget);
    
    const newSubcategories = (selectedCategory.subcategories || []).map(sub => {
        if (sub.id === selectedSubCategory.id) {
            const updatedSub: SubCategory = { 
                ...sub,
                name: formData.get("name") as string,
                frequency: categoryType === 'expense' ? (formData.get("frequency") as 'monthly' | 'occasional' || 'occasional') : undefined,
            };
            if (categoryType === 'expense') {
                const newBudget = parseFloat(formData.get("budget") as string);
                if (!isNaN(newBudget) && newBudget > 0) {
                    updatedSub.budget = newBudget;
                } else {
                    delete updatedSub.budget;
                }
            }
            return updatedSub;
        }
        return sub;
    });
    
    try {
        const categoryRef = doc(db, "categories", selectedCategory.id);
        await updateDoc(categoryRef, { subcategories: newSubcategories });
        setIsEditSubCategoryDialogOpen(false);
        setSelectedCategory(null);
        setSelectedSubCategory(null);
    } catch (error) {
    }
  }

  const handleDeleteSubCategory = async (category: Category, subCategoryToDelete: SubCategory) => {
     if (!user) return;
     try {
        const categoryRef = doc(db, "categories", category.id);
        const newSubcategories = (category.subcategories || []).filter(sub => sub.id !== subCategoryToDelete.id);
        await updateDoc(categoryRef, { subcategories: newSubcategories });
     } catch (error) {
     }
  }
  
  const handleSubCategoryOrderChange = useCallback(async (category: Category, newSubcategories: SubCategory[]) => {
    if (!user) return;
    const reorderedSubcategories = newSubcategories.map((sub, index) => ({...sub, order: index}));
    try {
        const categoryRef = doc(db, "categories", category.id);
        await updateDoc(categoryRef, { subcategories: reorderedSubcategories });
    } catch (error) {
    }
  }, [user]);

  const openSubCategoryDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsSubCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsEditCategoryDialogOpen(true);
  };

  const openEditSubCategoryDialog = (category: Category, subCategory: SubCategory) => {
    setSelectedCategory(category);
    setSelectedSubCategory(subCategory);
    setIsEditSubCategoryDialogOpen(true);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
        const oldIndex = categoryIds.indexOf(active.id as string);
        const newIndex = categoryIds.indexOf(over!.id as string);
        const reorderedItems = arrayMove(categories, oldIndex, newIndex);
        setCategories(reorderedItems);

        const batch = writeBatch(db);
        reorderedItems.forEach((item, index) => {
          const docRef = doc(db, "categories", item.id);
          batch.update(docRef, { order: index });
        });
        batch.commit().catch(err => {});
    }
  }

  const titleCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);


  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex justify-end">
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add {titleCase(categoryType)} Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddCategory}>
              <DialogHeader>
                <DialogTitle>Add New {titleCase(categoryType)} Category</DialogTitle>
                <DialogDescription>
                  Enter a name for your new {categoryType} category.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Utilities"
                    className="col-span-3"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Add Category</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <SortableContext items={categoryIds} strategy={rectSortingStrategy}>
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 pt-6">
                {categories.map((category) => (
                    <SortableCategoryCard 
                        key={category.id} 
                        category={category} 
                        onAddSubCategory={openSubCategoryDialog} 
                        onEditCategory={openEditCategoryDialog}
                        onDeleteCategory={handleDeleteCategory}
                        onEditSubCategory={openEditSubCategoryDialog}
                        onDeleteSubCategory={handleDeleteSubCategory}
                        onSubCategoryOrderChange={handleSubCategoryOrderChange}
                    />
                ))}
            </div>
        </SortableContext>
      </DndContext>
      
      {categories.length === 0 && !loading && (
        <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center text-center text-muted-foreground h-40 border-2 border-dashed rounded-lg mt-6">
          <Tag className="h-10 w-10 mb-2"/>
          <p>No {categoryType} categories found. Click "Add {titleCase(categoryType)} Category" to create your first one.</p>
        </div>
      )}


      {/* Add Sub-category Dialog */}
      <Dialog open={isSubCategoryDialogOpen} onOpenChange={setIsSubCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddSubCategory}>
            <DialogHeader>
              <DialogTitle>Add Sub-category</DialogTitle>
              <DialogDescription>
                Add a new sub-category to "{selectedCategory?.name}".
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sub-name">Name</Label>
                <Input id="sub-name" name="name" placeholder="e.g. Internet Bill" required />
              </div>
               {categoryType === 'expense' && (
                <>
                    <div className="space-y-2">
                        <Label>Frequency</Label>
                        <RadioGroup name="frequency" defaultValue="monthly" className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="monthly" id="r-monthly" />
                                <Label htmlFor="r-monthly">Monthly</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="occasional" id="r-occasional" />
                                <Label htmlFor="r-occasional">Occasional</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="budget">Monthly Budget (optional)</Label>
                        <Input id="budget" name="budget" type="number" placeholder="e.g. 500" className="hide-number-arrows" />
                    </div>
                </>
               )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={() => setSelectedCategory(null)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Add Sub-category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

       {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditCategory}>
            <DialogHeader>
                <DialogTitle>Edit Category</DialogTitle>
                <DialogDescription>
                Update the name for your category.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">
                        Name
                    </Label>
                    <Input id="edit-name" name="name" defaultValue={selectedCategory?.name} className="col-span-3" required />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={() => setSelectedCategory(null)}>Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Changes</Button>
            </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    {/* Edit Sub-Category Dialog */}
    <Dialog open={isEditSubCategoryDialogOpen} onOpenChange={setIsEditSubCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditSubCategory}>
            <DialogHeader>
                <DialogTitle>Edit Sub-category</DialogTitle>
                <DialogDescription>
                    Update the details for your sub-category.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-sub-name">Name</Label>
                    <Input id="edit-sub-name" name="name" defaultValue={selectedSubCategory?.name || ''} required />
                </div>
                 {categoryType === 'expense' && (
                    <>
                         <div className="space-y-2">
                            <Label>Frequency</Label>
                             <RadioGroup name="frequency" defaultValue={selectedSubCategory?.frequency || 'monthly'} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="monthly" id="er-monthly" />
                                    <Label htmlFor="er-monthly">Monthly</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="occasional" id="er-occasional" />
                                    <Label htmlFor="er-occasional">Occasional</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-budget">Monthly Budget (optional)</Label>
                            <Input id="edit-budget" name="budget" type="number" defaultValue={selectedSubCategory?.budget || ''} placeholder="e.g. 500" className="hide-number-arrows" />
                        </div>
                    </>
                )}
            </div>
            <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={() => {
                        setSelectedCategory(null);
                        setSelectedSubCategory(null);
                    }}>Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Changes</Button>
            </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}
