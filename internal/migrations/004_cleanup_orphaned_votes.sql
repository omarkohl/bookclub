DELETE FROM votes WHERE book_id NOT IN (SELECT id FROM books);
