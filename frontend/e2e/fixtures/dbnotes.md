# Database Indexing — Lecture 4

## B+ Tree Indexes
A B+ Tree of order m stores at most m-1 keys and m child pointers per internal node.
When a node overflows on insert, it splits and the middle key is promoted to the parent.
Leaf nodes are linked in a doubly linked list to support efficient range scans.

## Clustered vs Secondary Indexes
A clustered index determines the physical order of rows on disk, so a table can have
at most one clustered index. A secondary (non-clustered) index stores a copy of the
key plus a pointer to the row; lookups require an extra indirection.

## Composite Indexes and the Left-Prefix Rule
A composite index on (A, B, C) can serve queries that filter on A, on A and B, or on
A, B and C — always a left prefix. A query filtering only on B cannot use the index
for a seek.

## Write Cost
Every index must be updated on INSERT, UPDATE and DELETE, so indexes trade slower
writes and extra storage for faster reads.
