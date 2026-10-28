package com.vetconnect.repository;

import com.vetconnect.domain.entities.EmailVerificationOtp;
import com.vetconnect.domain.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailVerificationOtpRepository extends JpaRepository<EmailVerificationOtp, Long> {
    List<EmailVerificationOtp> findByUserAndUsedFalse(User user);
    Optional<EmailVerificationOtp> findFirstByUserOrderByIdDesc(User user);
}
