package com.vetconnect.repository;

import com.vetconnect.domain.entities.PasswordResetToken;
import com.vetconnect.domain.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    List<PasswordResetToken> findByUserAndUsedFalse(User user);
}
