
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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


function SortableSubCategoryItem({ 
  subCategory, 
  index,
  onEditSubCategory,
  onDeleteSubCategory
}: { 
  subCategory: SubCategory,
  index: number,
  onEditSubCategory: () => void,
  onDeleteSubCategory: () => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: subCategory.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'none',
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} className={cn(badgeVariants({variant: "secondary"}), "group relative flex justify-between items-center h-auto py-1 px-2.5 touch-none w-full sm:w-auto")}>
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
                    <GripVertical className="h-4 w-4 flex-shrink-0"/>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
                <span className="truncate" title={subCategory.name}>{subCategory.name}</span>
                {subCategory.amount && subCategory.amount > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">{formatCurrency(subCategory.amount)}</span>
                )}
            </div>

            <div className="flex items-center flex-shrink-0 pl-2">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={onEditSubCategory} className="p-0.5 hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                            <Pencil className="h-3.5 w-3.5"/>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Sub-category</TooltipContent>
                </Tooltip>
                <AlertDialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <button className="p-0.5 hover:text-destructive rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                    <Trash2 className="h-3.5 w-3.5"/>
                                </button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                         <TooltipContent>Delete Sub-category</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the "{subCategory.name}" subcategory. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDeleteSubCategory} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}


function SortableCategoryCard({ 
  category,
  categoryType,
  onAddSubCategory,
  onEditCategory,
  onDeleteCategory,
  onEditSubCategory,
  onDeleteSubCategory,
  onSubCategoryOrderChange,
}: { 
  category: Category, 
  categoryType: 'expense' | 'bank' | 'income',
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

    const monthlySubcategories = useMemo(
        () => category.subcategories.filter(s => s.frequency === 'monthly'), 
        [category.subcategories]
    );
    const occasionalSubcategories = useMemo(
        () => category.subcategories.filter(s => s.frequency !== 'monthly'), 
        [category.subcategories]
    );
    const allSubcategoryIds = useMemo(() => category.subcategories.map(s => s.id), [category.subcategories]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = allSubcategoryIds.indexOf(active.id as string);
            const newIndex = allSubcategoryIds.indexOf(over!.id as string);
            if (oldIndex === -1 || newIndex === -1) return;
            const reorderedSubcategories = arrayMove(category.subcategories, oldIndex, newIndex);
            onSubCategoryOrderChange(category, reorderedSubcategories);
        }
    }
    
    const totalAmount = useMemo(() => {
        if (categoryType === 'expense') {
            return category.subcategories
                .filter(sub => sub.frequency === 'monthly')
                .reduce((total, sub) => total + (sub.amount || 0), 0);
        }
        return category.subcategories.reduce((total, sub) => total + (sub.amount || 0), 0);
    }, [category.subcategories, categoryType]);

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="flex flex-col">
               <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <IconComponent className="h-6 w-6 text-muted-foreground mt-1" />
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                     {totalAmount > 0 && (
                        <CardDescription>{formatCurrency(totalAmount)}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 border rounded-md p-0.5">
                   <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditCategory(category)}>
                          <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Category</TooltipContent>
                  </Tooltip>
                  <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7">
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
                  <div {...attributes} {...listeners} className="touch-none p-1.5 cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-48 w-full p-6 pt-0">
                         <DndContext 
                            sensors={sensors} 
                            collisionDetection={closestCenter} 
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                         >
                            <SortableContext items={allSubcategoryIds} strategy={verticalListSortingStrategy}>
                                {category.subcategories.length > 0 ? (
                                    <div className="space-y-4">
                                        {categoryType === 'expense' ? (
                                            <>
                                                {monthlySubcategories.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Monthly</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {monthlySubcategories.map((sub, index) => (
                                                                <SortableSubCategoryItem 
                                                                    key={sub.id}
                                                                    index={index}
                                                                    subCategory={sub} 
                                                                    onEditSubCategory={() => onEditSubCategory(category, sub)}
                                                                    onDeleteSubCategory={() => onDeleteSubCategory(category, sub)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {occasionalSubcategories.length > 0 && (
                                                    <div>
                                                         <h4 className="text-sm font-medium my-2 text-muted-foreground">Occasional</h4>
                                                         <div className="flex flex-wrap gap-2">
                                                            {occasionalSubcategories.map((sub, index) => (
                                                                <SortableSubCategoryItem 
                                                                    key={sub.id}
                                                                    index={monthlySubcategories.length + index}
                                                                    subCategory={sub} 
                                                                    onEditSubCategory={() => onEditSubCategory(category, sub)}
                                                                    onDeleteSubCategory={() => onDeleteSubCategory(category, sub)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {category.subcategories.map((sub, index) => (
                                                    <SortableSubCategoryItem 
                                                        key={sub.id}
                                                        index={index}
                                                        subCategory={sub} 
                                                        onEditSubCategory={() => onEditSubCategory(category, sub)}
                                                        onDeleteSubCategory={() => onDeleteSubCategory(category, sub)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-20 flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">No sub-categories yet.</p>
                                    </div>
                                )}
                            </SortableContext>
                         </DndContext>
                    </ScrollArea>
                </CardContent>
               <CardFooter className="pt-4 border-t mt-auto">
                    <Button variant="outline" className="w-full" onClick={() => onAddSubCategory(category)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Sub-category
                  </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


export function CategoryList({ categoryType }: { categoryType: 'expense' | 'bank' | 'income' }) {
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
          const userCategories: Category[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            
            const subcategoriesFromData = Array.isArray(data.subcategories) 
                ? data.subcategories.sort((a: SubCategory, b: SubCategory) => (a.order || 0) - (b.order || 0))
                : [];
            
            return {
                id: doc.id,
                userId: data.userId,
                name: data.name,
                icon: data.icon,
                order: data.order,
                type: data.type,
                subcategories: subcategoriesFromData,
            };
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
      order: existingSubcategories.length,
    }
    
    if (categoryType === 'expense') {
        newSubCategory.frequency = formData.get("frequency") as 'monthly' | 'occasional' || 'occasional';
        const amount = parseFloat(formData.get("amount") as string);
        if (!isNaN(amount) && amount > 0) {
            newSubCategory.amount = amount;
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
            };
            if (categoryType === 'expense') {
                updatedSub.frequency = formData.get("frequency") as 'monthly' | 'occasional' || 'occasional';
                const newAmount = parseFloat(formData.get("amount") as string);
                if (!isNaN(newAmount) && newAmount > 0) {
                    updatedSub.amount = newAmount;
                } else {
                    delete updatedSub.amount;
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
        const newSubcategories = (category.subcategories || []).filter(sub => sub.id !== subCategoryToDelete.id).map((sub, index) => ({...sub, order: index}));
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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex justify-end mb-6">
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

      <ScrollArea className="h-[calc(100vh-220px)] pr-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <SortableContext items={categoryIds} strategy={rectSortingStrategy}>
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => (
                      <SortableCategoryCard 
                          key={category.id} 
                          category={category} 
                          categoryType={categoryType}
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
            <div className="col-span-full flex flex-col items-center justify-center text-center text-muted-foreground h-40 border-2 border-dashed rounded-lg mt-6">
                <Tag className="h-10 w-10 mb-2"/>
                <p>No {categoryType} categories found. Click "Add {titleCase(categoryType)} Category" to create your first one.</p>
            </div>
        )}
      </ScrollArea>
      

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
                      <Label htmlFor="amount">Amount (optional)</Label>
                      <Input id="amount" name="amount" type="number" placeholder="e.g. 500" className="hide-number-arrows" />
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
                      <Label htmlFor="edit-amount">Amount (optional)</Label>
                      <Input id="edit-amount" name="amount" type="number" defaultValue={selectedSubCategory?.amount || ''} placeholder="e.g. 500" className="hide-number-arrows" />
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

    